import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoHideDirective } from '../../auto-hide.directive';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, PublicidadGaleriaItem } from '../../modelos';
import { compartirPublicidad, enviarTextoWhatsApp } from '../../ticket-whatsapp.util';
import { generarLotePublicidad, PromoGenerada, DeptoPromo } from '../../promo-generador.util';

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
};

const LOTE_SIZE = 5;

@Component({
  selector: 'app-publicidad',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoHideDirective],
  templateUrl: './publicidad.component.html',
  styleUrl: './publicidad.component.scss',
})
export class PublicidadComponent implements OnInit, OnDestroy {
  error = '';
  ok = '';
  compartiendoId: string | null = null;
  /** Tras mandar la foto: texto listo para el 2º toque. */
  textoPendienteWa = '';
  enviandoTexto = false;
  preview: Promo | null = null;
  generando = false;
  /** Departamento del lote visible (para el título / botones). */
  deptoLote: DeptoPromo = 'LIMPIEZA';
  guardandoSeleccion = false;

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

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
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
    void this.generarMas('LIMPIEZA');
  }

  ngOnDestroy(): void {
    this.limpiarTodosBlobs();
  }

  private limpiarTodosBlobs(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.blobUrls = [];
  }

  cargarGaleria(): void {
    this.cargandoGaleria = true;
    this.api.publicidadGaleria().subscribe({
      next: (items) => {
        this.promosGaleria = items.map((i) => this.fromApi(i));
        this.cargandoGaleria = false;
      },
      error: (e: unknown) => {
        this.cargandoGaleria = false;
        this.error = e instanceof Error ? e.message : 'No se pudo cargar la galería';
      },
    });
  }

  private fromApi(i: PublicidadGaleriaItem): Promo {
    const raw = (i.src || '').trim();
    // Cache-bust + normalizar rutas viejas /api/publicidad/media → /publicidad
    let src = raw.replace(/^\/api\/publicidad\/media\//, '/publicidad/');
    if (src.startsWith('/publicidad/') || src.startsWith('/api/publicidad/')) {
      const sep = src.includes('?') ? '&' : '?';
      src = `${src}${sep}v=25`;
    }
    return {
      id: i.id,
      titulo: i.titulo,
      descripcion: i.descripcion || '',
      src,
      textoShare: i.textoShare || i.titulo,
      eliminable: i.eliminable,
    };
  }

  /** Si Chrome falla al pintar /publicidad/..., reintenta por API media. */
  onGaleriaImgError(ev: Event, p: Promo): void {
    const img = ev.target as HTMLImageElement;
    const src = p.src || '';
    if (src.includes('/publicidad/') && !src.includes('__retried=1')) {
      const name = src.split('/publicidad/')[1]?.split('?')[0];
      if (name) {
        const next = `/api/publicidad/media/${name}?v=25&__retried=1`;
        p.src = next;
        img.src = next;
        return;
      }
    }
    img.style.display = 'none';
  }

  /** Genera 5 nuevas aleatorias del departamento y las agrega al historial. */
  async generarMas(depto: DeptoPromo = 'LIMPIEZA'): Promise<void> {
    this.generando = true;
    this.error = '';
    this.ok = '';
    this.preview = null;
    try {
      // Si estamos en medio del historial, descartar “futuro” al generar nuevo lote
      if (this.indiceLote >= 0 && this.indiceLote < this.historialLotes.length - 1) {
        const descartados = this.historialLotes.slice(this.indiceLote + 1);
        for (const lote of descartados) {
          lote.forEach((p) => {
            if (p.src.startsWith('blob:')) URL.revokeObjectURL(p.src);
          });
        }
        this.historialLotes = this.historialLotes.slice(0, this.indiceLote + 1);
      }

      const inv = await new Promise<InventarioItem[]>((resolve, reject) => {
        this.api.inventario().subscribe({ next: resolve, error: reject });
      });
      const lote = await generarLotePublicidad(
        LOTE_SIZE,
        inv.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precioVentaHoy: p.precioVentaHoy,
          vendePor: p.vendePor,
          departamento: p.departamento,
        })),
        depto
      );
      const promos = lote.map((p) => this.fromGen(p));
      lote.forEach((p) => this.blobUrls.push(p.src));
      this.historialLotes.push(promos);
      this.indiceLote = this.historialLotes.length - 1;
      this.promosNuevas = promos;
      this.deptoLote = depto;
      this.ok = '';
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudieron generar las promos';
    } finally {
      this.generando = false;
    }
  }

  loteAnterior(): void {
    if (!this.puedeAnterior) return;
    this.indiceLote -= 1;
    this.promosNuevas = this.historialLotes[this.indiceLote];
    this.preview = null;
    this.ok = `Lote ${this.loteLabel}`;
  }

  loteSiguiente(): void {
    if (!this.puedeSiguiente) return;
    this.indiceLote += 1;
    this.promosNuevas = this.historialLotes[this.indiceLote];
    this.preview = null;
    this.ok = `Lote ${this.loteLabel}`;
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
        this.promosGaleria = [this.fromApi(item), ...this.promosGaleria];
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
        this.promosGaleria = [this.fromApi(item), ...this.promosGaleria];
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
    this.compartiendoId = p.id;
    try {
      const { modo, texto, automatico } = await compartirPublicidad(
        p.src,
        p.titulo,
        p.textoShare,
        p.blob
      );
      if (automatico) {
        this.textoPendienteWa = '';
        this.ok =
          modo === 'compartido'
            ? 'Listo: foto + mensaje (en ese orden) en un solo envío.'
            : 'Descargadas 2 imágenes · súbelas a WhatsApp (flyer y luego el texto).';
      } else {
        this.textoPendienteWa = texto;
        this.ok =
          'Tu celular no juntó las 2 imágenes. Foto enviada · toca «Enviar texto».';
      }
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudo compartir';
    } finally {
      this.compartiendoId = null;
    }
  }

  async enviarTextoPendiente(): Promise<void> {
    const texto = this.textoPendienteWa.trim();
    if (!texto || this.enviandoTexto) return;
    this.enviandoTexto = true;
    this.error = '';
    try {
      const modo = await enviarTextoWhatsApp(texto);
      this.textoPendienteWa = '';
      this.ok =
        modo === 'compartido'
          ? 'Texto enviado a WhatsApp (después de la foto).'
          : 'Se abrió WhatsApp con el texto · elígelo el mismo chat.';
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudo enviar el texto';
    } finally {
      this.enviandoTexto = false;
    }
  }

  cancelarTextoPendiente(): void {
    this.textoPendienteWa = '';
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
