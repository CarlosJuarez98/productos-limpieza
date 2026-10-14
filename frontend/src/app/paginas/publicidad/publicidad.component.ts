import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { PageAlertsComponent } from '../../page-alerts.component';
import { InventarioItem, PublicidadGaleriaItem, PublicidadCategoria } from '../../modelos';
import { compartirPublicidad } from '../../ticket-whatsapp.util';
import {
  generarLotePublicidad,
  generarLoteDesdeCategoriaDef,
  contarCategoriasPublicidad,
  CategoriaConteo,
  CategoriaPromoDef,
  PromoGenerada,
  DeptoPromo,
} from '../../promo-generador.util';

type Promo = {
  id: string;
  titulo: string;
  descripcion: string;
  src: string;
  textoShare: string;
  nueva?: boolean;
  eliminable?: boolean;
  vertical?: boolean;
  blob?: Blob;
  seleccionada?: boolean;
  guardando?: boolean;
  departamento?: DeptoPromo;
  categoria?: string;
};

type CatForm = {
  id: string | null;
  nombre: string;
  departamento: DeptoPromo;
  productoIds: number[];
  slogan: string;
  imagenEstatica: string;
  filtroProd: string;
};

const LOTE_SIZE = 5;

@Component({
  selector: 'app-publicidad',
  standalone: true,
  imports: [CommonModule, FormsModule, PageAlertsComponent],
  templateUrl: './publicidad.component.html',
  styleUrl: './publicidad.component.scss',
})
export class PublicidadComponent implements OnInit, OnDestroy {
  error = '';
  ok = '';
  compartiendoId: string | null = null;
  /** Tras mandar la foto: texto listo para el 2º toque. */
  textoPendienteWa = '';
  /** PNG de «Buenos días» listo para el 2º share (gesto del usuario). */
  private mensajePendienteFile: File | null = null;
  enviandoTexto = false;
  preview: Promo | null = null;
  generando = false;
  /** Departamento del lote visible (para el título / botones). */
  deptoLote: DeptoPromo = 'LIMPIEZA';
  /** Id de categoría del último lote. */
  categoriaLote: string | null = null;
  guardandoSeleccion = false;

  /** Conteos por categoría editable. */
  categorias: CategoriaConteo[] = [];
  private categoriasRaw: PublicidadCategoria[] = [];
  private inventarioCache: InventarioItem[] = [];

  /** Editor de categoría. */
  catEditorAbierto = false;
  catGuardando = false;
  catSubiendoImg = false;
  catForm: CatForm = this.catFormVacio();
  catPreviewSrc = '';

  /** Lote visible (siempre 5 generadas). */
  promosNuevas: Promo[] = [];
  /** Historial de lotes para volver atrás / adelante. */
  private historialLotes: Promo[][] = [];
  indiceLote = -1;
  private blobUrls: string[] = [];

  get puedeAnterior(): boolean {
    return this.indiceLote > 0;
  }

  get puedeSiguiente(): boolean {
    return this.indiceLote >= 0 && this.indiceLote < this.historialLotes.length - 1;
  }

  get loteLabel(): string {
    if (this.indiceLote < 0) return '';
    return `${this.indiceLote + 1} / ${this.historialLotes.length}`;
  }

  get seleccionCount(): number {
    return this.promosNuevas.filter((p) => p.seleccionada && p.blob).length;
  }

  promosGaleria: Promo[] = [];
  cargandoGaleria = false;
  subiendo = false;
  borrandoId: string | null = null;
  nuevoTitulo = '';
  nuevoDesc = '';

  /** Cache-bust de galería (cambia al cargar la página). */
  private galeriaBust = Date.now();
  private galeriaBlobUrls: string[] = [];

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
    this.cargarGaleria();
    void this.cargarInventarioYCategorias().then(() => this.generarMas('LIMPIEZA'));
  }

  private async cargarInventarioYCategorias(): Promise<InventarioItem[]> {
    // Separado: si categorías fallan, igual tenemos inventario para el picker.
    try {
      const inv = await new Promise<InventarioItem[]>((resolve, reject) => {
        this.api.inventario().subscribe({ next: resolve, error: reject });
      });
      this.inventarioCache = inv || [];
    } catch (e: unknown) {
      this.error = this.msgError(e, 'No se pudo cargar el inventario');
    }
    try {
      const cats = await new Promise<PublicidadCategoria[]>((resolve, reject) => {
        this.api.publicidadCategorias().subscribe({ next: resolve, error: reject });
      });
      this.categoriasRaw = cats || [];
      this.refrescarConteosCategorias();
    } catch (e: unknown) {
      this.categorias = [];
      this.categoriasRaw = [];
      this.error = this.msgError(e, 'No se pudieron cargar categorías');
    }
    this.cdr.detectChanges();
    return this.inventarioCache;
  }

  private refrescarConteosCategorias(): void {
    const defs = this.categoriasRaw.map((c) => this.toDef(c));
    this.categorias = contarCategoriasPublicidad(
      this.inventarioCache.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precioVentaHoy: p.precioVentaHoy,
        vendePor: p.vendePor,
        departamento: p.departamento,
      })),
      defs
    );
  }

  private toDef(c: PublicidadCategoria): CategoriaPromoDef {
    return {
      id: c.id,
      nombre: c.nombre,
      depto: c.departamento === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA',
      productoIds: c.productoIds || [],
      slogan: c.slogan,
      imagenSrc: c.imagenSrc,
    };
  }

  labelCategoria(id: string | null | undefined): string {
    if (!id) return '';
    return this.categorias.find((c) => c.id === id)?.nombre || id;
  }

  private catFormVacio(): CatForm {
    return {
      id: null,
      nombre: '',
      departamento: 'LIMPIEZA',
      productoIds: [],
      slogan: '',
      imagenEstatica: '',
      filtroProd: '',
    };
  }

  /** Inventario para el picker: con texto busca en todos; sin texto prioriza el depto. */
  get productosPicker(): InventarioItem[] {
    const q = this.normTxt(this.catForm.filtroProd);
    const deptoCat = this.catForm.departamento;
    const list = this.inventarioCache.filter((p) => {
      if (!(p.nombre || '').trim()) return false;
      if (q) return this.normTxt(p.nombre).includes(q);
      const depto = p.departamento === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA';
      return depto === deptoCat;
    });
    // Con búsqueda: mismos depto primero, luego el resto
    if (q) {
      list.sort((a, b) => {
        const da = a.departamento === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA';
        const db = b.departamento === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA';
        const sa = da === deptoCat ? 0 : 1;
        const sb = db === deptoCat ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      });
    }
    return list.slice(0, q ? 100 : 80);
  }

  get pickerVacioHint(): string {
    if (!this.inventarioCache.length) {
      return 'No se cargó el inventario. Cierra y vuelve a abrir, o recarga la página.';
    }
    if (this.catForm.filtroProd?.trim()) {
      return 'Ningún producto coincide con esa búsqueda.';
    }
    return 'No hay productos de este departamento.';
  }

  private normTxt(s: string | null | undefined): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  productoSeleccionado(id: number): boolean {
    return this.catForm.productoIds.includes(id);
  }

  toggleProducto(id: number): void {
    const i = this.catForm.productoIds.indexOf(id);
    if (i >= 0) {
      this.catForm.productoIds = this.catForm.productoIds.filter((x) => x !== id);
    } else {
      this.catForm.productoIds = [...this.catForm.productoIds, id];
    }
  }

  quitarProductoSeleccionado(id: number, ev?: Event): void {
    ev?.stopPropagation();
    this.catForm.productoIds = this.catForm.productoIds.filter((x) => x !== id);
  }

  nombreProducto(id: number): string {
    return this.inventarioCache.find((p) => p.id === id)?.nombre || `#${id}`;
  }

  abrirNuevaCategoria(): void {
    this.catForm = this.catFormVacio();
    this.catPreviewSrc = '';
    this.catEditorAbierto = true;
    void this.asegurarInventarioParaPicker();
  }

  abrirEditarCategoria(c: CategoriaConteo, ev?: Event): void {
    ev?.stopPropagation();
    const raw = this.categoriasRaw.find((x) => x.id === c.id);
    this.catForm = {
      id: c.id,
      nombre: c.nombre,
      departamento: c.depto,
      productoIds: [...(c.productoIds || [])],
      slogan: c.slogan || '',
      imagenEstatica: raw && !raw.imagenCustom ? raw.imagenSrc || '' : '',
      filtroProd: '',
    };
    this.catPreviewSrc = c.imagenSrc || '';
    this.catEditorAbierto = true;
    void this.asegurarInventarioParaPicker();
  }

  private async asegurarInventarioParaPicker(): Promise<void> {
    if (this.inventarioCache.length > 0) {
      this.cdr.detectChanges();
      return;
    }
    try {
      await this.cargarInventarioYCategorias();
    } finally {
      this.cdr.detectChanges();
    }
  }

  cerrarEditorCategoria(): void {
    this.catEditorAbierto = false;
    this.catForm = this.catFormVacio();
    this.catPreviewSrc = '';
  }

  guardarCategoria(): void {
    const nombre = this.catForm.nombre.trim();
    if (!nombre) {
      this.error = 'Indica el nombre de la categoría';
      return;
    }
    const body = {
      nombre,
      departamento: this.catForm.departamento,
      productoIds: [...this.catForm.productoIds],
      slogan: this.catForm.slogan.trim() || null,
      imagenEstatica: this.catForm.imagenEstatica.trim() || null,
    };
    this.catGuardando = true;
    this.error = '';
    const req$ = this.catForm.id
      ? this.api.actualizarPublicidadCategoria(this.catForm.id, body)
      : this.api.crearPublicidadCategoria(body);
    req$.subscribe({
      next: (item) => {
        if (this.catForm.id) {
          this.categoriasRaw = this.categoriasRaw.map((x) => (x.id === item.id ? item : x));
        } else {
          this.categoriasRaw = [...this.categoriasRaw, item];
        }
        this.refrescarConteosCategorias();
        this.catGuardando = false;
        this.ok = this.catForm.id ? 'Categoría actualizada' : 'Categoría creada';
        this.cerrarEditorCategoria();
        this.cdr.detectChanges();
      },
      error: (e: unknown) => {
        this.catGuardando = false;
        this.error = this.msgError(e, 'No se pudo guardar la categoría');
      },
    });
  }

  onElegirImagenCategoria(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.catForm.id) {
      this.error = 'Guarda la categoría primero y luego sube la imagen';
      return;
    }
    this.catSubiendoImg = true;
    this.api.subirImagenCategoria(this.catForm.id, file).subscribe({
      next: (item) => {
        this.categoriasRaw = this.categoriasRaw.map((x) => (x.id === item.id ? item : x));
        this.refrescarConteosCategorias();
        this.catPreviewSrc = item.imagenSrc || '';
        this.catForm.imagenEstatica = '';
        this.catSubiendoImg = false;
        this.ok = 'Imagen de categoría actualizada';
        this.cdr.detectChanges();
      },
      error: (e: unknown) => {
        this.catSubiendoImg = false;
        this.error = this.msgError(e, 'No se pudo subir la imagen');
      },
    });
  }

  quitarImagenCategoria(): void {
    if (!this.catForm.id) return;
    this.catSubiendoImg = true;
    this.api.quitarImagenCategoria(this.catForm.id).subscribe({
      next: (item) => {
        this.categoriasRaw = this.categoriasRaw.map((x) => (x.id === item.id ? item : x));
        this.refrescarConteosCategorias();
        this.catPreviewSrc = item.imagenSrc || '';
        this.catSubiendoImg = false;
        this.ok = 'Imagen quitada';
        this.cdr.detectChanges();
      },
      error: (e: unknown) => {
        this.catSubiendoImg = false;
        this.error = this.msgError(e, 'No se pudo quitar la imagen');
      },
    });
  }

  async eliminarCategoria(c: CategoriaConteo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const ok = await this.confirmDlg.ask(`¿Eliminar la categoría «${c.nombre}»?`, {
      titulo: 'Eliminar categoría',
      confirmarTexto: 'Eliminar',
      cancelarTexto: 'Cancelar',
    });
    if (!ok) return;
    this.api.eliminarPublicidadCategoria(c.id).subscribe({
      next: () => {
        this.categoriasRaw = this.categoriasRaw.filter((x) => x.id !== c.id);
        this.refrescarConteosCategorias();
        if (this.categoriaLote === c.id) this.categoriaLote = null;
        if (this.catForm.id === c.id) this.cerrarEditorCategoria();
        this.ok = 'Categoría eliminada';
        this.cdr.detectChanges();
      },
      error: (e: unknown) => {
        this.error = this.msgError(e, 'No se pudo eliminar');
      },
    });
  }

  ngOnDestroy(): void {
    this.limpiarTodosBlobs();
    this.limpiarGaleriaBlobs();
  }

  private limpiarTodosBlobs(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.blobUrls = [];
  }

  private limpiarGaleriaBlobs(): void {
    this.galeriaBlobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.galeriaBlobUrls = [];
  }

  cargarGaleria(): void {
    this.cargandoGaleria = true;
    this.galeriaBust = Date.now();
    this.limpiarGaleriaBlobs();
    this.api.publicidadGaleria().subscribe({
      next: (items) => {
        this.promosGaleria = items.map((i) => this.fromApi(i));
        this.cargandoGaleria = false;
        void this.hidratarGaleriaComoBlob(this.promosGaleria);
      },
      error: (e: unknown) => {
        this.cargandoGaleria = false;
        this.error = e instanceof Error ? e.message : 'No se pudo cargar la galería';
      },
    });
  }

  /** URL de media (API) sin query. */
  private mediaUrl(raw: string): string {
    const s = (raw || '').trim();
    const estatica = s.match(/^\/(?:api\/publicidad\/media\/|publicidad\/)([^?]+)/);
    if (estatica) return `/api/publicidad/media/${estatica[1]}`;
    if (s.startsWith('/api/publicidad/galeria/archivo/')) return s.split('?')[0];
    return s.split('?')[0];
  }

  private fromApi(i: PublicidadGaleriaItem): Promo {
    const url = this.mediaUrl(i.src || '');
    return {
      id: i.id,
      titulo: i.titulo,
      descripcion: i.descripcion || '',
      src: url ? `${url}?v=${this.galeriaBust}` : '',
      textoShare: i.textoShare || i.titulo,
      eliminable: i.eliminable,
    };
  }

  /**
   * Chrome a veces no pinta <img src="/publicidad/..."> por caché rota / HTML de SPA.
   * Bajamos el archivo con fetch(no-store) y lo mostramos como blob: — siempre visible.
   */
  private async hidratarGaleriaComoBlob(promos: Promo[]): Promise<void> {
    await Promise.all(
      promos.map(async (p) => {
        const url = (p.src || '').split('?')[0];
        if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
        const candidates: string[] = [];
        if (url.includes('/api/publicidad/media/')) {
          candidates.push(url, url.replace('/api/publicidad/media/', '/publicidad/'));
        } else if (url.startsWith('/publicidad/')) {
          candidates.push(
            url.replace('/publicidad/', '/api/publicidad/media/'),
            url
          );
        } else if (url.startsWith('/api/publicidad/galeria/archivo/')) {
          candidates.push(url);
        } else {
          candidates.push(url);
        }
        for (const u of candidates) {
          try {
            const res = await fetch(u, { credentials: 'same-origin', cache: 'no-store' });
            if (!res.ok) continue;
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html') || ct.includes('application/json')) continue;
            const blob = await res.blob();
            const okType =
              blob.type.startsWith('image/') ||
              (!blob.type && blob.size > 500) ||
              ct.startsWith('image/');
            if (!okType || blob.size < 64) continue;
            const obj = URL.createObjectURL(blob);
            this.galeriaBlobUrls.push(obj);
            p.src = obj;
            p.blob = blob;
            this.cdr.detectChanges();
            return;
          } catch {
            /* siguiente candidato */
          }
        }
      })
    );
  }

  /** Sin ocultar la imagen (antes display:none dejaba el cuadro gris). */
  onGaleriaImgError(_ev: Event, _p: Promo): void {
    /* hidratarGaleriaComoBlob ya reintenta; no esconder */
  }

  fondoGaleria(src: string | undefined): string {
    if (!src) return 'none';
    // Escapar comillas por si el blob/data URL viene raro en algún navegador.
    const safe = src.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `url("${safe}")`;
  }

  /** Genera 5 nuevas aleatorias del departamento y las agrega al historial. */
  async generarMas(depto: DeptoPromo = 'LIMPIEZA'): Promise<void> {
    await this.generarLote(depto, null);
  }

  /** Genera un lote solo con productos de esa categoría editable. */
  async generarPorCategoria(cat: CategoriaConteo): Promise<void> {
    if (!cat.count || this.generando) return;
    await this.generarLote(cat.depto, cat);
  }

  private async generarLote(depto: DeptoPromo, cat: CategoriaConteo | null): Promise<void> {
    this.generando = true;
    this.error = '';
    this.ok = '';
    this.preview = null;
    try {
      if (this.indiceLote >= 0 && this.indiceLote < this.historialLotes.length - 1) {
        const descartados = this.historialLotes.slice(this.indiceLote + 1);
        for (const lote of descartados) {
          lote.forEach((p) => {
            if (p.src.startsWith('blob:')) URL.revokeObjectURL(p.src);
          });
        }
        this.historialLotes = this.historialLotes.slice(0, this.indiceLote + 1);
      }

      const inv =
        this.inventarioCache.length > 0
          ? this.inventarioCache
          : await this.cargarInventarioYCategorias();
      const productos = inv.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precioVentaHoy: p.precioVentaHoy,
        vendePor: p.vendePor,
        departamento: p.departamento,
      }));
      const lote = cat
        ? await generarLoteDesdeCategoriaDef(LOTE_SIZE, productos, cat)
        : await generarLotePublicidad(LOTE_SIZE, productos, depto);
      const promos = lote.map((p) => this.fromGen(p));
      lote.forEach((p) => this.blobUrls.push(p.src));
      this.historialLotes.push(promos);
      this.indiceLote = this.historialLotes.length - 1;
      this.promosNuevas = promos;
      this.deptoLote = depto;
      this.categoriaLote = cat?.id || null;
      this.ok = cat ? `Lote de ${cat.nombre} listo` : '';
      this.cdr.detectChanges();
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudieron generar las promos';
    } finally {
      this.generando = false;
      this.cdr.detectChanges();
    }
  }

  loteAnterior(): void {
    if (!this.puedeAnterior) return;
    this.indiceLote -= 1;
    this.promosNuevas = this.historialLotes[this.indiceLote];
    this.sincronizarMetaLote();
    this.preview = null;
    this.ok = `Lote ${this.loteLabel}`;
  }

  loteSiguiente(): void {
    if (!this.puedeSiguiente) return;
    this.indiceLote += 1;
    this.promosNuevas = this.historialLotes[this.indiceLote];
    this.sincronizarMetaLote();
    this.preview = null;
    this.ok = `Lote ${this.loteLabel}`;
  }

  private sincronizarMetaLote(): void {
    const first = this.promosNuevas[0];
    this.deptoLote = first?.departamento || 'LIMPIEZA';
    this.categoriaLote = first?.categoria || null;
  }

  private fromGen(p: PromoGenerada): Promo {
    return {
      id: p.id,
      titulo: p.titulo,
      descripcion: p.descripcion,
      src: p.src,
      textoShare: p.textoShare,
      nueva: true,
      vertical: p.vertical,
      blob: p.blob,
      eliminable: false,
      seleccionada: false,
      departamento: p.departamento,
      categoria: p.categoria,
    };
  }

  toggleSeleccion(p: Promo, ev?: Event): void {
    ev?.stopPropagation();
    if (!p.blob) return;
    p.seleccionada = !p.seleccionada;
  }

  async agregarSeleccionadas(): Promise<void> {
    const elegidas = this.promosNuevas.filter((p) => p.seleccionada && p.blob);
    if (!elegidas.length) return;
    this.guardandoSeleccion = true;
    this.error = '';
    this.ok = '';
    let okN = 0;
    for (const p of elegidas) {
      p.guardando = true;
      try {
        const file = new File([p.blob!], `${p.id}.png`, { type: 'image/png' });
        const item = await new Promise<PublicidadGaleriaItem>((resolve, reject) => {
          this.api.subirPublicidadGaleria(file, p.titulo, p.descripcion).subscribe({
            next: resolve,
            error: reject,
          });
        });
        const nuevo = this.fromApi(item);
        this.promosGaleria = [nuevo, ...this.promosGaleria];
        void this.hidratarGaleriaComoBlob([nuevo]);
        p.seleccionada = false;
        okN++;
      } catch (e: unknown) {
        this.error = this.msgError(e, `No se pudo guardar «${p.titulo}»`);
      } finally {
        p.guardando = false;
      }
    }
    this.guardandoSeleccion = false;
    if (okN > 0) {
      this.ok = okN === 1 ? '1 promo agregada a la galería' : `${okN} promos agregadas a la galería`;
    }
  }

  abrirPreview(p: Promo): void {
    this.preview = p;
  }

  cerrarPreview(): void {
    this.preview = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.catEditorAbierto) {
      this.cerrarEditorCategoria();
      return;
    }
    if (this.preview) this.cerrarPreview();
  }

  onElegirArchivo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.subir(file);
  }

  subir(file: File): void {
    this.error = '';
    this.ok = '';
    this.subiendo = true;
    this.api.subirPublicidadGaleria(file, this.nuevoTitulo, this.nuevoDesc).subscribe({
      next: (item) => {
        const nuevo = this.fromApi(item);
        this.promosGaleria = [nuevo, ...this.promosGaleria];
        void this.hidratarGaleriaComoBlob([nuevo]);
        this.nuevoTitulo = '';
        this.nuevoDesc = '';
        this.subiendo = false;
      },
      error: (e: unknown) => {
        this.subiendo = false;
        this.error = this.msgError(e, 'No se pudo subir la imagen');
      },
    });
  }

  async borrar(p: Promo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!p.eliminable) return;
    const ok = await this.confirmDlg.ask(`¿Quitar «${p.titulo}» de la galería?`, {
      titulo: 'Quitar de la galería',
      confirmarTexto: 'Quitar',
      cancelarTexto: 'Cancelar',
    });
    if (!ok) return;
    this.error = '';
    this.ok = '';
    this.borrandoId = p.id;
    this.api.eliminarPublicidadGaleria(p.id).subscribe({
      next: () => {
        this.promosGaleria = this.promosGaleria.filter((x) => x.id !== p.id);
        if (this.preview?.id === p.id) this.preview = null;
        this.borrandoId = null;
      },
      error: (e: unknown) => {
        this.borrandoId = null;
        this.error = this.msgError(e, 'No se pudo borrar');
      },
    });
  }

  async compartir(p: Promo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    this.error = '';
    this.ok = '';
    this.textoPendienteWa = '';
    this.mensajePendienteFile = null;
    this.compartiendoId = p.id;
    try {
      const { modo, texto, automatico } = await compartirPublicidad(
        p.src,
        p.titulo,
        p.textoShare,
        p.blob,
        // Galería guardada (sin blob de flyer): pie de pagos/horario; promos nuevas ya lo traen
        { pieContacto: !p.blob }
      );
      if (automatico) {
        this.textoPendienteWa = '';
        this.mensajePendienteFile = null;
        this.ok =
          modo === 'compartido'
            ? 'Listo: foto con el texto en «Añadir mensaje».'
            : 'Foto descargada · texto en portapapeles.';
      } else {
        this.textoPendienteWa = texto;
        this.ok =
          'Foto lista. En WhatsApp toca «Añadir mensaje» y pega (el texto ya está copiado).';
      }
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudo compartir';
    } finally {
      this.compartiendoId = null;
    }
  }

  async copiarTextoPendiente(): Promise<void> {
    const texto = this.textoPendienteWa.trim();
    if (!texto || this.enviandoTexto) return;
    this.enviandoTexto = true;
    this.error = '';
    try {
      await navigator.clipboard.writeText(texto);
      this.ok = 'Texto copiado. En WhatsApp: «Añadir mensaje» → pegar.';
    } catch {
      this.error = 'No se pudo copiar. Selecciona y copia el texto a mano.';
    } finally {
      this.enviandoTexto = false;
    }
  }

  cancelarTextoPendiente(): void {
    this.textoPendienteWa = '';
    this.mensajePendienteFile = null;
  }

  private msgError(e: unknown, fallback: string): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const body = (e as { error?: { message?: string; error?: string } }).error;
      if (body?.message) return body.message;
      if (body?.error) return body.error;
    }
    return e instanceof Error ? e.message : fallback;
  }
}
