import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, Subscription } from 'rxjs';
import { of } from 'rxjs';
import { ApiService } from '../../api.service';
import { CapturaDraftService } from '../../captura-draft.service';
import { ClearableDirective } from '../../clearable.directive';
import { SoloNumerosDirective } from '../../solo-numeros.directive';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { Entrada, InventarioItem, Produccion, Receta, RecetaInsumo } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { ProductoAltaFormComponent } from '../../producto-alta-form.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import { FechaDiaComponent } from '../../fecha-dia.component';
import { PullRefreshService } from '../../pull-refresh.service';
import { alinearLineasCaptura, capturaEsMovil, capturaLineasVacias, capturaBreakpointCambio, capturaTieneFocoEnCampo, PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { AutoHideDirective } from '../../auto-hide.directive';
import { enfocarPorAttr, programarEnfoque, scrollLineaPorAttr } from '../../captura-focus.util';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
  /** Precio unitario (se calcula: total pagado ÷ cantidad). */
  precioProveedor: number | null;
  /** Lo que pagaste por la cantidad; vacío hasta que lo captures. */
  totalPagado: number | null;
  /** Si true, esta línea participa en el traspaso (icono activo). */
  tambienTraspasar: boolean;
  /** Cantidad a traspasar de esta línea (opcional, ≤ cantidad de entrada). */
  cantidadTraspaso: number | null;
}

type CambioPrecio = 'SUBIO' | 'BAJO' | 'IGUAL' | null;

type AvisoMenudeo = 'bajo_min' | 'en_min' | 'ok' | 'sobre_max' | 'sin_venta';

interface CambioCapturado {
  productoId: number;
  nombre: string;
  cambio: 'SUBIO' | 'BAJO';
  compraAnterior: number | null;
}

interface RevisionPrecioItem {
  productoId: number;
  nombre: string;
  cambio: 'SUBIO' | 'BAJO';
  compraAnterior: number | null;
  compraNueva: number;
  ventaHoy: number;
  minSugerido: number;
  maxSugerido: number;
  mayoreo5: number;
  mayoreo10: number;
  avisoMenudeo: AvisoMenudeo;
}

type DraftEntradas = {
  fecha: string;
  lineas: Array<Omit<LineaForm, 'key'> & { tambienTraspasar?: boolean; totalPagado?: number | null }>;
  nextKey: number;
  /** @deprecated Preferir por línea; se migra al restaurar. */
  tambienTraspasar?: boolean;
  traspasoPersona: string;
  prep: {
    fecha: string;
    productoResultadoId: number | null;
    cantidadResultado: number | null;
    productoInsumoId: number | null;
    cantidadInsumo: number | null;
    insumoNombre: string;
    insumos: { productoInsumoId: number; nombre: string; cantidad: number }[];
  };
};

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductoAutocompleteComponent,
    ProductoAltaFormComponent,
    FechaDmYPipe,
    FechaDiaComponent,
    ClearableDirective,
    SoloNumerosDirective,
    PaginadorComponent,
    AutoHideDirective,
  ],
  templateUrl: './entradas.component.html',
  styleUrl: './entradas.component.scss',
})
export class EntradasComponent implements OnInit, OnDestroy {
  private static readonly DRAFT = 'entradas';

  @ViewChildren('prodLote') prodAutos!: QueryList<ProductoAutocompleteComponent>;

  entradas: Entrada[] = [];
  producciones: Produccion[] = [];
  pagEntradas = new PaginacionEstado<Entrada>();
  pagPrep = new PaginacionEstado<Produccion>();
  productos: InventarioItem[] = [];
  personasNombres: string[] = [];
  error = '';
  errorPrep = '';
  okPrep = '';
  ok = '';
  errorEdit = '';
  /** Productos cuyo precio de compra subió/bajó: comparar menudeo vs rango sugerido. */
  revisionPrecios: RevisionPrecioItem[] = [];
  recalculandoMargenes = false;
  okMargenes = '';
  errorMargenes = '';
  guardando = false;
  guardandoEdit = false;
  /** Persona destino cuando alguna línea tiene traspaso activo. */
  traspasoPersona = '';
  /** Móvil: paneles secundarios colapsados por defecto. */
  prepAbierta = typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches;
  histAbierta = typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches;
  recetasAbierta = false;
  /** Móvil: pestaña Preparar vs Fórmulas. */
  prepVista: 'preparar' | 'formulas' = 'preparar';
  recetas: Receta[] = [];
  formReceta = this.formRecetaVacio();
  editandoRecetaId: number | null = null;
  guardandoRecetas = false;
  errorRecetas = '';
  okRecetas = '';
  /** Alta de producto embebida al armar una fórmula. */
  altaProductoPara: 'resultado' | 'insumo' | null = null;
  altaInsumoIndex: number | null = null;
  private nextKey = 1;
  private pullSub?: Subscription;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private capturaMovil = capturaEsMovil();
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  lineas: LineaForm[] = this.crearLineasVacias();
  prep = {
    fecha: this.hoyLocal(),
    productoResultadoId: null as number | null,
    cantidadResultado: null as number | null,
    productoInsumoId: null as number | null,
    cantidadInsumo: null as number | null,
    insumoNombre: '' as string,
    insumos: [] as { productoInsumoId: number; nombre: string; cantidad: number }[],
  };
  editandoPrepId: number | null = null;
  editandoEntradaId: number | null = null;
  formEdit = {
    fecha: this.hoyLocal(),
    productoId: null as number | null,
    cantidad: null as number | null,
    precioProveedor: null as number | null,
    totalPagado: null as number | null,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private pullRefresh: PullRefreshService,
    private route: ActivatedRoute,
    private router: Router,
    private drafts: CapturaDraftService
  ) {}

  ngOnInit(): void {
    this.restaurarBorrador();
    this.alinearLineasViewport();
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.persistirBorrador();
    this.pullSub?.unsubscribe();
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
  }

  @HostListener('window:resize')
  onResizeCaptura(): void {
    if (capturaTieneFocoEnCampo()) return;
    const { cambio, movil } = capturaBreakpointCambio(this.capturaMovil);
    if (!cambio) return;
    this.capturaMovil = movil;
    this.alinearLineasViewport();
  }

  private entradaLineaVacia(l: LineaForm): boolean {
    return (
      l.productoId == null &&
      !(Number(l.cantidad) > 0) &&
      !(Number(l.precioProveedor) > 0) &&
      !(Number(l.totalPagado) > 0)
    );
  }

  private alinearLineasViewport(): void {
    this.lineas = alinearLineasCaptura(
      this.lineas,
      (l) => this.entradaLineaVacia(l),
      () => this.nuevaLinea()
    );
  }

  @HostListener('window:pagehide')
  @HostListener('document:visibilitychange')
  onGuardarBorrador(): void {
    this.persistirBorrador();
  }

  togglePrep(): void {
    this.prepAbierta = !this.prepAbierta;
  }

  toggleRecetas(): void {
    this.recetasAbierta = !this.recetasAbierta;
    this.prepVista = this.recetasAbierta ? 'formulas' : 'preparar';
    if (this.recetasAbierta) {
      this.cancelarFormReceta();
      this.errorRecetas = '';
      this.okRecetas = '';
    }
  }

  setPrepVista(v: 'preparar' | 'formulas'): void {
    this.prepVista = v;
    this.recetasAbierta = v === 'formulas';
    if (v === 'formulas') {
      this.errorRecetas = '';
    }
  }

  elegirPreparable(id: number): void {
    this.onResultadoChange(id);
  }

  ajustarCantPrep(delta: number): void {
    const actual = Number(this.prep.cantidadResultado);
    const base = Number.isFinite(actual) && actual > 0 ? actual : 0;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    this.prep.cantidadResultado = next > 0 ? next : null;
    this.onCantidadPrepChange();
  }

  pctAguaFormula(): number {
    const agua = this.num(this.formReceta.cantidadAgua);
    const ins = this.totalInsumosFormula();
    const t = agua + ins;
    if (t <= 0) return 0;
    return Math.round((agua / t) * 100);
  }

  formulaCuadra(): boolean {
    const prod = this.num(this.formReceta.cantidadProducto);
    if (prod <= 0) return false;
    const suma = this.num(this.formReceta.cantidadAgua) + this.totalInsumosFormula();
    return Math.abs(suma - prod) < 0.00015;
  }

  cancelarEdicionRecetas(): void {
    this.recetasAbierta = false;
    this.prepVista = 'preparar';
    this.cancelarFormReceta();
    this.errorRecetas = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editandoEntradaId != null) {
      this.cancelarEdicionEntrada();
      return;
    }
    if (this.editandoPrepId != null) {
      this.cancelarEdicionPrep();
      return;
    }
    if (this.editandoRecetaId != null) {
      this.cancelarFormReceta();
      return;
    }
    if (this.recetasAbierta) {
      this.cancelarEdicionRecetas();
    }
  }

  private formRecetaVacio() {
    return {
      productoResultadoId: null as number | null,
      cantidadProducto: null as number | null,
      cantidadAgua: null as number | null,
      insumos: [{ productoInsumoId: null as number | null, cantidad: null as number | null }],
    };
  }

  cancelarFormReceta(): void {
    this.editandoRecetaId = null;
    this.formReceta = this.formRecetaVacio();
    this.altaProductoPara = null;
    this.altaInsumoIndex = null;
  }

  nuevaFormula(): void {
    this.editandoRecetaId = null;
    this.formReceta = this.formRecetaVacio();
    this.altaProductoPara = null;
    this.altaInsumoIndex = null;
    this.errorRecetas = '';
    this.okRecetas = '';
  }

  editarFormula(r: Receta): void {
    this.editandoRecetaId = r.id;
    const insumos =
      r.insumos?.length
        ? r.insumos.map((i) => ({
            productoInsumoId: i.productoInsumoId as number | null,
            cantidad: i.cantidad as number | null,
          }))
        : [{ productoInsumoId: r.productoInsumoId as number | null, cantidad: r.cantidadInsumo as number | null }];
    this.formReceta = {
      productoResultadoId: r.productoResultadoId,
      cantidadProducto: r.cantidadProducto,
      cantidadAgua: r.cantidadAgua,
      insumos,
    };
    this.altaProductoPara = null;
    this.altaInsumoIndex = null;
    this.errorRecetas = '';
  }

  agregarInsumoFormula(): void {
    this.formReceta.insumos.push({ productoInsumoId: null, cantidad: null });
  }

  quitarInsumoFormula(i: number): void {
    if (this.formReceta.insumos.length <= 1) return;
    this.formReceta.insumos.splice(i, 1);
  }

  abrirAltaProducto(para: 'resultado' | 'insumo', index?: number): void {
    this.altaProductoPara = para;
    this.altaInsumoIndex = para === 'insumo' ? (index ?? 0) : null;
  }

  onProductoCreadoFormula(item: InventarioItem): void {
    const para = this.altaProductoPara;
    this.productos = [...this.productos.filter((p) => p.id !== item.id), item];
    if (para === 'resultado') {
      this.formReceta.productoResultadoId = item.id;
    } else if (para === 'insumo') {
      const idx = this.altaInsumoIndex ?? 0;
      if (this.formReceta.insumos[idx]) {
        this.formReceta.insumos[idx].productoInsumoId = item.id;
      }
    }
    this.altaProductoPara = null;
    this.altaInsumoIndex = null;
    this.okRecetas = `Producto «${item.nombre}» agregado`;
  }

  textoInsumosReceta(r: Receta): string {
    const list = this.insumosDeReceta(r);
    return list.map((i) => `${this.fmtNum(i.cantidad)} L ${i.productoInsumoNombre}`).join(' + ');
  }

  insumosDeReceta(r: Receta): RecetaInsumo[] {
    if (r.insumos?.length) return r.insumos;
    return [
      {
        productoInsumoId: r.productoInsumoId,
        productoInsumoNombre: r.productoInsumoNombre,
        cantidad: r.cantidadInsumo,
      },
    ];
  }

  textoInsumosProduccion(p: Produccion): string {
    return this.insumosDeProduccion(p)
      .map((i) => `${this.fmtNum(i.cantidad)} L ${i.productoInsumoNombre}`)
      .join(' · ');
  }

  insumosDeProduccion(p: Produccion): RecetaInsumo[] {
    if (p.insumos?.length) {
      return p.insumos.map((i) => ({
        productoInsumoId: i.productoInsumoId,
        productoInsumoNombre: i.productoInsumoNombre,
        cantidad: i.cantidad,
      }));
    }
    return [
      {
        productoInsumoId: p.productoInsumoId,
        productoInsumoNombre: p.productoInsumoNombre,
        cantidad: p.cantidadInsumo,
      },
    ];
  }

  num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private fmtNum(n: number): string {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return String(Math.round(x * 10000) / 10000);
  }

  totalInsumosFormula(): number {
    return this.formReceta.insumos.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  }

  /** Desde Ventas: /entradas?preparar=id → abre Preparación. */
  private aplicarQueryPreparar(): void {
    const raw = this.route.snapshot.queryParamMap.get('preparar');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    const prod = this.productos.find((p) => p.id === id);
    if (!prod || !this.esProductoPreparacion(prod.id)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      return;
    }
    this.prepAbierta = true;
    this.onResultadoChange(id);
    this.cdr.detectChanges();
    setTimeout(() => {
      document.getElementById('entradas-prep-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  toggleHist(): void {
    this.histAbierta = !this.histAbierta;
  }

  hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get fechaMax(): string {
    return this.hoyLocal();
  }

  private sumarDias(iso: string, dias: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  private asegurarFechaValida(): void {
    const hoy = this.hoyLocal();
    if (this.fecha > hoy) this.fecha = hoy;
    if (this.fechaMin && this.fecha < this.fechaMin) this.fecha = this.fechaMin;
    if (this.prep.fecha > hoy) this.prep.fecha = hoy;
    if (this.fechaMin && this.prep.fecha < this.fechaMin) this.prep.fecha = this.fechaMin;
    if (this.formEdit.fecha > hoy) this.formEdit.fecha = hoy;
  }

  private validarFecha(fecha: string, destino: 'error' | 'errorPrep' | 'errorEdit' = 'error'): boolean {
    if (!fecha) {
      this[destino] = 'Indica la fecha';
      return false;
    }
    if (fecha > this.hoyLocal()) {
      this[destino] = 'No se pueden registrar fechas futuras';
      return false;
    }
    if (this.fechaUltimoCorte && fecha <= this.fechaUltimoCorte) {
      this[destino] =
        `No se pueden registrar el ${formatFechaDmY(this.fechaUltimoCorte)} ni antes (ya hubo corte). Usa una fecha desde ${formatFechaDmY(this.fechaMin)}.`;
      return false;
    }
    if (this.fechaMin && fecha < this.fechaMin) {
      this[destino] = `La fecha debe ser desde ${formatFechaDmY(this.fechaMin)} (día siguiente al último corte)`;
      return false;
    }
    return true;
  }

  private crearLineasVacias(): LineaForm[] {
    return Array.from({ length: capturaLineasVacias() }, () => this.nuevaLinea());
  }

  private nuevaLinea(): LineaForm {
    return {
      key: this.nextKey++,
      productoId: null,
      cantidad: null,
      precioProveedor: null,
      totalPagado: null,
      tambienTraspasar: false,
      cantidadTraspaso: null,
    };
  }

  onProductoChange(l: LineaForm, id: number | null): void {
    l.productoId = id;
    this.programarBorrador();
  }

  onCantidadChange(l: LineaForm): void {
    this.recalcularPrecioDesdeTotal(l);
    this.programarBorrador();
  }

  /** Unidad del precio (L o pza) según el producto. */
  etiquetaPrecio(productoId: number | null): string {
    const p = this.productos.find((x) => x.id === productoId);
    return p?.vendePor === 'PIEZA' ? 'Precio / pza' : 'Precio / L';
  }

  /**
   * Detecta si el valor en Precio parece el total pagado (cant × última)
   * en vez del precio unitario. Ej: 0.250 L × $36 = $9.
   */
  nombreProducto(productoId: number | null): string {
    if (productoId == null) return '—';
    return this.productos.find((p) => p.id === productoId)?.nombre || '—';
  }

  get hayTraspasoActivo(): boolean {
    return this.lineas.some((l) => l.tambienTraspasar);
  }

  toggleTraspasoLinea(l: LineaForm): void {
    l.tambienTraspasar = !l.tambienTraspasar;
    if (!l.tambienTraspasar) {
      l.cantidadTraspaso = null;
    }
    if (!this.hayTraspasoActivo) {
      this.traspasoPersona = '';
    }
    this.programarBorrador();
  }

  /** True si la cantidad a traspasar supera lo que entra en esa línea. */
  excedeTraspaso(l: LineaForm): boolean {
    const cantEnt = Number(l.cantidad);
    const cantTr = Number(l.cantidadTraspaso);
    if (!Number.isFinite(cantTr) || cantTr <= 0) return false;
    if (!Number.isFinite(cantEnt) || cantEnt <= 0) return cantTr > 0;
    return cantTr > cantEnt;
  }

  /** Última compra con precio (historial ya viene fecha desc). */
  ultimaCompra(productoId: number | null): number | null {
    if (productoId == null) return null;
    const previa = this.entradas.find(
      (e) => e.productoId === productoId && e.precioProveedor != null && Number(e.precioProveedor) > 0
    );
    if (previa?.precioProveedor != null) return Number(previa.precioProveedor);
    const inv = this.productos.find((p) => p.id === productoId);
    const compra = inv != null ? Number(inv.precioCompra) : 0;
    return compra > 0 ? compra : null;
  }

  cambioLinea(l: LineaForm): CambioPrecio {
    const actual = Number(l.precioProveedor);
    const anterior = this.ultimaCompra(l.productoId);
    if (!Number.isFinite(actual) || actual < 0 || anterior == null) return null;
    if (String(l.precioProveedor) === '' || l.precioProveedor == null) return null;
    const diff = Math.round((actual - anterior) * 100) / 100;
    if (Math.abs(diff) < 0.005) return 'IGUAL';
    return diff > 0 ? 'SUBIO' : 'BAJO';
  }

  /** Precio unitario listo para mostrar (no usar Number/String en el template). */
  tienePrecioUnitario(precio: number | null | undefined): boolean {
    if (precio == null || String(precio) === '') return false;
    const n = Number(precio);
    return Number.isFinite(n) && n >= 0;
  }

  /** Diferencia absoluta vs última compra (para mostrar en badge). */
  diffAbsLinea(l: LineaForm): number {
    return Math.abs(this.diffLinea(l) ?? 0);
  }

  diffLinea(l: LineaForm): number | null {
    const actual = Number(l.precioProveedor);
    const anterior = this.ultimaCompra(l.productoId);
    if (!Number.isFinite(actual) || anterior == null || l.precioProveedor == null || String(l.precioProveedor) === '') {
      return null;
    }
    return Math.round((actual - anterior) * 100) / 100;
  }

  cambioEntrada(e: Entrada): CambioPrecio {
    if (e.precioMayor) return 'SUBIO';
    if (e.precioMenor) return 'BAJO';
    if (e.precioProveedor != null && e.precioCompraAnterior != null) return 'IGUAL';
    return null;
  }

  get hayEntradasConCambioPrecio(): boolean {
    return this.entradas.some((e) => e.precioMayor || e.precioMenor);
  }

  textoAvisoMenudeo(a: AvisoMenudeo): string {
    switch (a) {
      case 'bajo_min':
        return 'Menudeo bajo el mínimo → conviene subir';
      case 'en_min':
        return 'Menudeo en el mínimo (justo)';
      case 'sobre_max':
        return 'Menudeo arriba del máximo → puedes bajar';
      case 'sin_venta':
        return 'Sin precio de menudeo';
      default:
        return 'Menudeo dentro del rango';
    }
  }

  private avisoMenudeoDe(p: InventarioItem): AvisoMenudeo {
    const venta = Number(p.precioVentaHoy) || 0;
    if (venta <= 0) return 'sin_venta';
    if (p.precioVentaBajoMinimo) return 'bajo_min';
    if (p.precioVentaEnMinimo) return 'en_min';
    const max = Number(p.precioMaximoSugerido) || 0;
    if (max > 0 && venta > max + 0.005) return 'sobre_max';
    return 'ok';
  }

  private construirRevision(cambios: CambioCapturado[]): void {
    const porId = new Map<number, CambioCapturado>();
    for (const c of cambios) {
      if (c.productoId == null) continue;
      porId.set(c.productoId, c);
    }
    const items: RevisionPrecioItem[] = [];
    for (const c of porId.values()) {
      const p = this.productos.find((x) => x.id === c.productoId);
      if (!p) continue;
      items.push({
        productoId: c.productoId,
        nombre: p.nombre || c.nombre,
        cambio: c.cambio,
        compraAnterior: c.compraAnterior,
        compraNueva: Number(p.precioCompra) || 0,
        ventaHoy: Number(p.precioVentaHoy) || 0,
        minSugerido: Number(p.precioMinimoSugerido) || 0,
        maxSugerido: Number(p.precioMaximoSugerido) || 0,
        mayoreo5: Number(p.precioMayoreo5) || 0,
        mayoreo10: Number(p.precioMayoreo10) || 0,
        avisoMenudeo: this.avisoMenudeoDe(p),
      });
    }
    items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    this.revisionPrecios = items;
    this.okMargenes = '';
    this.errorMargenes = '';
    if (items.length) {
      setTimeout(() => {
        document.querySelector('.revision-margenes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }

  private capturarCambiosDeLineas(lineasForm: LineaForm[]): CambioCapturado[] {
    const out: CambioCapturado[] = [];
    for (const l of lineasForm) {
      const c = this.cambioLinea(l);
      if (c !== 'SUBIO' && c !== 'BAJO') continue;
      if (l.productoId == null) continue;
      out.push({
        productoId: l.productoId,
        nombre: this.nombreProducto(l.productoId),
        cambio: c,
        compraAnterior: this.ultimaCompra(l.productoId),
      });
    }
    return out;
  }

  private refrescarInventarioYRevision(cambios: CambioCapturado[]): void {
    this.api.inventario().subscribe({
      next: (p) => {
        this.productos = p;
        if (cambios.length) this.construirRevision(cambios);
      },
    });
  }

  revisarPreciosCambiados(): void {
    this.errorMargenes = '';
    const seen = new Set<number>();
    const cambios: CambioCapturado[] = [];
    for (const e of this.entradas) {
      if (!e.precioMayor && !e.precioMenor) continue;
      if (seen.has(e.productoId)) continue;
      seen.add(e.productoId);
      cambios.push({
        productoId: e.productoId,
        nombre: e.productoNombre,
        cambio: e.precioMayor ? 'SUBIO' : 'BAJO',
        compraAnterior:
          e.precioCompraAnterior != null ? Number(e.precioCompraAnterior) : null,
      });
    }
    if (!cambios.length) {
      this.errorMargenes = 'No hay entradas con precio que haya subido o bajado';
      return;
    }
    this.refrescarInventarioYRevision(cambios);
  }

  cerrarRevision(): void {
    this.revisionPrecios = [];
    this.okMargenes = '';
    this.errorMargenes = '';
  }

  irAInventario(): void {
    void this.router.navigate(['/inventario']);
  }

  async recalcularMayoreoDesdeMargenes(): Promise<void> {
    if (!this.revisionPrecios.length) return;
    const ok = await this.confirmDlg.ask(
      '¿Recalcular mayoreo (≥5 / ≥10) con los % de margen actuales? El menudeo no se cambia solo: revísalo en Inventario si hace falta.',
      { confirmarTexto: 'Recalcular mayoreo' }
    );
    if (!ok) return;
    this.recalculandoMargenes = true;
    this.errorMargenes = '';
    this.okMargenes = '';
    const ids = this.revisionPrecios.map((r) => r.productoId);
    const anteriores = new Map(
      this.revisionPrecios.map((r) => [r.productoId, { cambio: r.cambio, compraAnterior: r.compraAnterior, nombre: r.nombre }])
    );
    this.api.aplicarPreciosDesdeMargenes().subscribe({
      next: () => {
        this.api.inventario().subscribe({
          next: (p) => {
            this.productos = p;
            const cambios: CambioCapturado[] = ids.map((id) => {
              const prev = anteriores.get(id)!;
              return {
                productoId: id,
                nombre: prev.nombre,
                cambio: prev.cambio,
                compraAnterior: prev.compraAnterior,
              };
            });
            this.construirRevision(cambios);
            this.recalculandoMargenes = false;
            this.okMargenes = 'Mayoreo recalculado. Revisa si el menudeo sigue en rango.';
          },
          error: () => {
            this.recalculandoMargenes = false;
            this.errorMargenes = 'Mayoreo aplicado, pero no se pudo refrescar inventario';
          },
        });
      },
      error: (e) => {
        this.recalculandoMargenes = false;
        this.errorMargenes = e.error?.error || 'No se pudo recalcular el mayoreo';
      },
    });
  }

  /** Total capturado por el usuario (no se rellena solo). */
  totalLinea(l: LineaForm): number | null {
    if (l.totalPagado != null && String(l.totalPagado) !== '') {
      const t = Number(l.totalPagado);
      return Number.isFinite(t) && t >= 0 ? Math.round(t * 100) / 100 : null;
    }
    return null;
  }

  private recalcularPrecioDesdeTotal(l: LineaForm): void {
    const total = Number(l.totalPagado);
    const cant = Number(l.cantidad);
    if (
      l.totalPagado == null ||
      String(l.totalPagado) === '' ||
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(cant) ||
      cant <= 0
    ) {
      if (l.totalPagado == null || String(l.totalPagado) === '') {
        l.precioProveedor = null;
      }
      return;
    }
    l.precioProveedor = Math.round((total / cant) * 10000) / 10000;
  }

  /**
   * Escribes lo que pagaste por esa cantidad → se calcula el precio por L/pza.
   * El campo queda vacío hasta que lo captures (no se rellena solo).
   */
  onTotalPagadoChange(l: LineaForm, raw: number | string | null): void {
    if (raw === '' || raw == null) {
      l.totalPagado = null;
      l.precioProveedor = null;
      this.programarBorrador();
      return;
    }
    const total = Number(raw);
    if (!Number.isFinite(total) || total < 0) {
      this.programarBorrador();
      return;
    }
    l.totalPagado = Math.round(total * 100) / 100;
    this.recalcularPrecioDesdeTotal(l);
    this.programarBorrador();
  }

  onPrecioUnitarioChange(l: LineaForm): void {
    this.programarBorrador();
  }

  onFormEditTotalChange(raw: number | string | null): void {
    if (raw === '' || raw == null) {
      this.formEdit.totalPagado = null;
      this.formEdit.precioProveedor = null;
      return;
    }
    const total = Number(raw);
    if (!Number.isFinite(total) || total < 0) return;
    this.formEdit.totalPagado = Math.round(total * 100) / 100;
    const cant = Number(this.formEdit.cantidad);
    if (Number.isFinite(cant) && cant > 0) {
      this.formEdit.precioProveedor = Math.round((total / cant) * 10000) / 10000;
    }
  }

  onFormEditCantidadChange(): void {
    const total = Number(this.formEdit.totalPagado);
    const cant = Number(this.formEdit.cantidad);
    if (
      this.formEdit.totalPagado != null &&
      Number.isFinite(total) &&
      total >= 0 &&
      Number.isFinite(cant) &&
      cant > 0
    ) {
      this.formEdit.precioProveedor = Math.round((total / cant) * 10000) / 10000;
    }
  }

  /** Enter en total pagado → siguiente fila. */
  onTotalEnter(ev: Event, index: number): void {
    ev.preventDefault();
    this.avanzarTrasPrecio(index);
  }

  private avanzarTrasPrecio(index: number): void {
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      this.cdr.detectChanges();
    }
    this.enfocarCaptura(Math.min(irA, this.lineas.length - 1), 'producto');
  }

  get totalLote(): number {
    return Math.round(
      this.lineas.reduce((s, l) => s + (this.totalLinea(l) ?? 0), 0) * 100
    ) / 100;
  }

  get productosPreparables(): InventarioItem[] {
    return this.productos.filter((p) => this.esProductoPreparacion(p.id));
  }

  /** Entradas de proveedor: sin productos que se preparan. */
  get productosParaEntrada(): InventarioItem[] {
    return this.productos.filter((p) => !this.esProductoPreparacion(p.id));
  }

  private esProductoPreparacion(productoId: number | null | undefined): boolean {
    if (productoId == null) return false;
    return this.recetas.some((r) => r.productoResultadoId === productoId);
  }

  private ratiosInsumoPorProducto(
    productoId: number | null | undefined
  ): { productoInsumoId: number; nombre: string; ratio: number }[] {
    if (productoId == null) return [];
    const r = this.recetas.find((x) => x.productoResultadoId === productoId);
    if (!r) return [];
    const p = Number(r.cantidadProducto);
    if (!(p > 0)) return [];
    return this.insumosDeReceta(r).map((i) => ({
      productoInsumoId: i.productoInsumoId,
      nombre: i.productoInsumoNombre,
      ratio: Number(i.cantidad) / p,
    }));
  }

  onResultadoChange(id: number | null): void {
    this.programarBorrador();
    this.prep.productoResultadoId = id;
    this.prep.productoInsumoId = null;
    this.prep.insumoNombre = '';
    this.prep.cantidadInsumo = null;
    this.prep.insumos = [];
    this.errorPrep = '';
    if (id == null) return;
    this.api.recetaProduccion(id).subscribe({
      next: (r) => {
        if (r.encontrada && (r.insumos?.length || r.productoInsumoId != null)) {
          const insumos =
            r.insumos?.length
              ? r.insumos
              : [
                  {
                    productoInsumoId: r.productoInsumoId!,
                    productoInsumoNombre: r.productoInsumoNombre || '',
                    cantidad: Number(r.cantidadInsumo) || 0,
                  },
                ];
          this.prep.productoInsumoId = insumos[0]?.productoInsumoId ?? null;
          this.prep.insumoNombre = insumos.map((i) => i.productoInsumoNombre).join(' + ');
          this.recalcularInsumoPrep();
          this.programarBorrador();
        } else {
          this.errorPrep = 'No hay fórmula para ese producto. Créala en «Editar fórmulas».';
        }
      },
    });
  }

  onCantidadPrepChange(): void {
    this.recalcularInsumoPrep();
    this.programarBorrador();
  }

  recalcularInsumoPrep(): void {
    const ratios = this.ratiosInsumoPorProducto(this.prep.productoResultadoId);
    const cant = Number(this.prep.cantidadResultado);
    if (!ratios.length || !Number.isFinite(cant) || cant <= 0) {
      if (this.editandoPrepId == null) {
        this.prep.cantidadInsumo = null;
        this.prep.insumos = [];
      }
      return;
    }
    this.prep.insumos = ratios.map((x) => ({
      productoInsumoId: x.productoInsumoId,
      nombre: x.nombre,
      cantidad: Math.round(cant * x.ratio * 100) / 100,
    }));
    this.prep.cantidadInsumo =
      Math.round(this.prep.insumos.reduce((s, i) => s + i.cantidad, 0) * 100) / 100;
    this.prep.productoInsumoId = this.prep.insumos[0]?.productoInsumoId ?? null;
    this.prep.insumoNombre = this.prep.insumos.map((i) => i.nombre).join(' + ');
  }

  guardarFormula(): void {
    this.errorRecetas = '';
    this.okRecetas = '';
    const f = this.formReceta;
    if (f.productoResultadoId == null) {
      this.errorRecetas = 'Elige el producto preparado';
      return;
    }
    const insumos = f.insumos
      .filter((i) => i.productoInsumoId != null && Number(i.cantidad) > 0)
      .map((i) => ({
        productoInsumoId: i.productoInsumoId as number,
        cantidad: Number(i.cantidad),
      }));
    if (!insumos.length) {
      this.errorRecetas = 'Agrega al menos un insumo con cantidad';
      return;
    }
    const body = {
      productoResultadoId: f.productoResultadoId,
      cantidadProducto: Number(f.cantidadProducto),
      cantidadAgua: Number(f.cantidadAgua),
      insumos,
    };
    if (
      !Number.isFinite(body.cantidadProducto) ||
      body.cantidadProducto <= 0 ||
      !Number.isFinite(body.cantidadAgua) ||
      body.cantidadAgua < 0
    ) {
      this.errorRecetas = 'Revisa las cantidades de la fórmula';
      return;
    }
    this.guardandoRecetas = true;
    const req$ =
      this.editandoRecetaId != null
        ? this.api.actualizarReceta(this.editandoRecetaId, body)
        : this.api.crearReceta(body);
    req$.subscribe({
      next: () => {
        this.guardandoRecetas = false;
        this.okRecetas = this.editandoRecetaId != null ? 'Fórmula actualizada' : 'Fórmula creada';
        this.cancelarFormReceta();
        this.api.recetas().subscribe({
          next: (lista) => {
            this.recetas = lista || [];
            this.recalcularInsumoPrep();
          },
        });
      },
      error: (e) => {
        this.guardandoRecetas = false;
        this.errorRecetas = e.error?.error || 'No se pudo guardar la fórmula';
      },
    });
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.programarBorrador();
    this.enfocarCaptura(this.lineas.length - 1, 'producto');
  }

  onFechaEnter(_ev?: Event): void {
    this.enfocarCaptura(0, 'producto');
  }

  /** Enter en producto → cantidad. */
  onProductoEnter(index: number): void {
    this.enfocarCaptura(index, 'cantidad');
  }

  /** Enter en cantidad → total pagado. */
  onCantidadEnter(ev: Event, index: number): void {
    ev.preventDefault();
    this.programarBorrador();
    this.enfocarCaptura(index, 'total');
  }

  /** Enter en precio unitario → siguiente fila. */
  onPrecioEnter(ev: Event, index: number): void {
    ev.preventDefault();
    this.programarBorrador();
    this.avanzarTrasPrecio(index);
  }

  private autosVisibles(): ProductoAutocompleteComponent[] {
    return (this.prodAutos?.toArray() || []).filter((a) => a.estaVisible());
  }

  private enfocarCaptura(index: number, campo: 'producto' | 'cantidad' | 'precio' | 'total'): void {
    const go = () => {
      const key = this.lineas[index]?.key;
      if (campo === 'cantidad') {
        enfocarPorAttr('data-cant-key', key ?? '');
      } else if (campo === 'precio') {
        enfocarPorAttr('data-precio-key', key ?? '');
      } else if (campo === 'total') {
        enfocarPorAttr('data-total-key', key ?? '');
      } else {
        this.autosVisibles()[index]?.focus();
      }
      if (key != null) scrollLineaPorAttr('data-linea-key', key);
    };
    this.cdr.detectChanges();
    programarEnfoque(go);
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas[index] = this.nuevaLinea();
      this.alinearLineasViewport();
      this.programarBorrador();
      return;
    }
    this.lineas.splice(index, 1);
    this.alinearLineasViewport();
    this.programarBorrador();
  }

  cargar(): void {
    this.api.entradas().subscribe({
      next: (e) => {
        this.entradas = e;
        this.pagEntradas.setItems(this.entradas, false);
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar entradas'),
    });
    this.api.producciones().subscribe({
      next: (p) => {
        this.producciones = p;
        this.pagPrep.setItems(this.producciones, false);
      },
      error: () => {
        this.producciones = [];
        this.pagPrep.setItems([], false);
      },
    });
    this.api.inventario().subscribe({
      next: (p) => {
        this.productos = p;
        this.aplicarQueryPreparar();
      },
    });
    this.api.recetas().subscribe({
      next: (r) => {
        this.recetas = r || [];
        this.recalcularInsumoPrep();
        this.aplicarQueryPreparar();
      },
    });
    this.api.personas().subscribe({
      next: (p) => {
        this.personasNombres = (p || []).map((x) => x.nombre).filter(Boolean);
      },
      error: () => {
        this.personasNombres = [];
      },
    });
    this.api.caja().subscribe({
      next: (c) => {
        this.fechaMin = c.fechaInicio || null;
        this.fechaUltimoCorte =
          c.fechaUltimoCorte || (c.fechaInicio ? this.sumarDias(c.fechaInicio, -1) : null);
        this.asegurarFechaValida();
      },
    });
  }

  async eliminarFormula(r: Receta): Promise<void> {
    const ok = await this.confirmDlg.ask(`¿Eliminar fórmula de ${r.productoResultadoNombre}?`, {
      confirmarTexto: 'Eliminar',
    });
    if (!ok) return;
    this.api.eliminarReceta(r.id).subscribe({
      next: () => {
        this.okRecetas = 'Fórmula eliminada';
        if (this.editandoRecetaId === r.id) this.cancelarFormReceta();
        this.api.recetas().subscribe({ next: (lista) => (this.recetas = lista || []) });
      },
      error: (e) => (this.errorRecetas = e.error?.error || 'No se pudo eliminar'),
    });
  }

  stockDe(productoId: number): number {
    const p = this.productos.find((x) => x.id === productoId);
    return p ? Number(p.stockActual) || 0 : 0;
  }

  get stockInsumoPrep(): number {
    if (!this.prep.insumos.length && this.prep.productoInsumoId != null) {
      return this.stockDe(this.prep.productoInsumoId);
    }
    if (!this.prep.insumos.length) return 0;
    return Math.min(...this.prep.insumos.map((i) => this.stockDe(i.productoInsumoId)));
  }

  get excedeStockInsumoPrep(): boolean {
    if (!this.prep.insumos.length) {
      const need = Number(this.prep.cantidadInsumo);
      if (!Number.isFinite(need) || need <= 0 || this.prep.productoInsumoId == null) return false;
      return need > this.stockDe(this.prep.productoInsumoId) + 1e-9;
    }
    return this.prep.insumos.some((i) => i.cantidad > this.stockDe(i.productoInsumoId) + 1e-9);
  }

  insumosFaltantesPrep(): string {
    return this.prep.insumos
      .filter((i) => i.cantidad > this.stockDe(i.productoInsumoId) + 1e-9)
      .map((i) => `${i.nombre} (necesitas ${i.cantidad}, hay ${this.stockDe(i.productoInsumoId)})`)
      .join('; ');
  }

  guardar(): void {
    this.error = '';
    this.ok = '';
    this.asegurarFechaValida();
    if (!this.validarFecha(this.fecha)) return;

    const lineasForm = this.lineas.filter((l) => l.productoId != null && Number(l.cantidad) > 0);
    const lineas = lineasForm.map((l) => ({
      productoId: l.productoId as number,
      productoNombre: this.nombreProducto(l.productoId),
      cantidad: Number(l.cantidad),
      precioProveedor:
        l.precioProveedor != null && String(l.precioProveedor) !== ''
          ? Number(l.precioProveedor)
          : null,
      aplicarAPedido: false,
      pedidoId: null as number | null,
    }));
    if (!lineas.length) {
      this.error = 'Agrega al menos un producto con cantidad';
      return;
    }
    const prohibido = lineas
      .map((l) => this.productos.find((p) => p.id === l.productoId))
      .find((p) => p && this.esProductoPreparacion(p.id));
    if (prohibido) {
      this.error =
        `«${prohibido.nombre}» se obtiene por preparación, no por entrada de proveedor`;
      return;
    }

    let lineasTraspaso: { productoId: number; productoNombre?: string; cantidad: number }[] = [];
    const lineasConTraspaso = lineasForm.filter((l) => l.tambienTraspasar);
    if (lineasConTraspaso.length) {
      if (!this.traspasoPersona.trim()) {
        this.error = 'Selecciona una persona de la lista';
        return;
      }
      for (const l of lineasConTraspaso) {
        const cantEnt = Number(l.cantidad);
        const cantTr = Number(l.cantidadTraspaso);
        if (!Number.isFinite(cantTr) || cantTr <= 0) {
          this.error = `Indica cuánto traspasar de «${this.nombreProducto(l.productoId)}»`;
          return;
        }
        if (cantTr > cantEnt) {
          this.error = `En «${this.nombreProducto(l.productoId)}» no puedes traspasar más de lo que entra (${cantEnt})`;
          return;
        }
        lineasTraspaso.push({
          productoId: l.productoId as number,
          productoNombre: this.nombreProducto(l.productoId),
          cantidad: cantTr,
        });
      }
    }

    const persona = this.traspasoPersona.trim();
    const fechaGuardada = this.fecha;
    const cambiosPrecio = this.capturarCambiosDeLineas(lineasForm);
    this.guardando = true;
    this.api
      .crearEntradasLote({
        fecha: fechaGuardada,
        lineas,
      })
      .pipe(
        switchMap(() => {
          if (!lineasTraspaso.length) return of(null);
          return this.api.crearTraspaso({
            fecha: fechaGuardada,
            persona,
            nota: 'Desde entrada de proveedor',
            lineas: lineasTraspaso,
          });
        })
      )
      .subscribe({
        next: () => {
          this.guardando = false;
          const nTr = lineasTraspaso.length;
          this.ok = nTr
            ? `Entrada registrada y traspaso a ${persona} listo`
            : 'Entrada registrada';
          this.lineas = this.crearLineasVacias();
          this.traspasoPersona = '';
          this.persistirBorrador();
          this.cargar();
          this.refrescarInventarioYRevision(cambiosPrecio);
        },
        error: (e) => {
          this.guardando = false;
          this.error =
            e.error?.error ||
            (lineasTraspaso.length
              ? 'La entrada se pudo guardar, pero falló el traspaso. Revísalo en Traspasos.'
              : 'Error al guardar entradas');
          this.persistirBorrador();
          this.cargar();
        },
      });
  }

  editarEntrada(e: Entrada): void {
    this.errorEdit = '';
    this.editandoEntradaId = e.id;
    const cant = e.cantidad != null ? Number(e.cantidad) : null;
    const precio = e.precioProveedor != null ? Number(e.precioProveedor) : null;
    const total =
      cant != null &&
      Number.isFinite(cant) &&
      cant > 0 &&
      precio != null &&
      Number.isFinite(precio) &&
      precio >= 0
        ? Math.round(cant * precio * 100) / 100
        : null;
    this.formEdit = {
      fecha: e.fecha,
      productoId: e.productoId,
      cantidad: cant,
      precioProveedor: precio,
      totalPagado: total,
    };
    this.cdr.detectChanges();
    setTimeout(() => {
      const el =
        document.querySelector('.hist-edicion-movil') || document.querySelector('.fila-edicion');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  cancelarEdicionEntrada(): void {
    this.editandoEntradaId = null;
    this.errorEdit = '';
    this.guardandoEdit = false;
  }

  guardarEdicionEntrada(): void {
    if (this.editandoEntradaId == null) return;
    this.errorEdit = '';
    this.asegurarFechaValida();
    if (!this.validarFecha(this.formEdit.fecha, 'errorEdit')) return;
    const cant = Number(this.formEdit.cantidad);
    if (this.formEdit.productoId == null || !Number.isFinite(cant) || cant <= 0) {
      this.errorEdit = 'Completa producto y cantidad';
      return;
    }
    const prod = this.productos.find((p) => p.id === this.formEdit.productoId);
    if (prod && this.esProductoPreparacion(prod.id)) {
      this.errorEdit =
        `«${prod.nombre}» se obtiene por preparación, no por entrada de proveedor`;
      return;
    }
    this.guardandoEdit = true;
    const pid = this.formEdit.productoId as number;
    const nuevoPrecio =
      this.formEdit.precioProveedor != null && String(this.formEdit.precioProveedor) !== ''
        ? Number(this.formEdit.precioProveedor)
        : null;
    const compraActual = Number(this.productos.find((p) => p.id === pid)?.precioCompra) || 0;
    let cambiosEdit: CambioCapturado[] = [];
    if (nuevoPrecio != null && Number.isFinite(nuevoPrecio) && compraActual > 0) {
      const diff = Math.round((nuevoPrecio - compraActual) * 100) / 100;
      if (Math.abs(diff) >= 0.005) {
        cambiosEdit = [
          {
            productoId: pid,
            nombre: this.nombreProducto(pid),
            cambio: diff > 0 ? 'SUBIO' : 'BAJO',
            compraAnterior: compraActual,
          },
        ];
      }
    }
    this.api
      .actualizarEntrada(this.editandoEntradaId, {
        fecha: this.formEdit.fecha,
        productoId: this.formEdit.productoId,
        cantidad: cant,
        precioProveedor: nuevoPrecio,
        actualizarPrecioCompra: true,
        aplicarAPedido: null,
        pedidoId: null,
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          this.cancelarEdicionEntrada();
          this.cargar();
          this.refrescarInventarioYRevision(cambiosEdit);
        },
        error: (e) => {
          this.guardandoEdit = false;
          this.errorEdit = e.error?.error || 'Error al actualizar entrada';
        },
      });
  }

  editarProduccion(p: Produccion): void {
    this.errorPrep = '';
    this.okPrep = '';
    this.editandoPrepId = p.id;
    const insumos = p.insumos?.length
      ? p.insumos.map((i) => ({
          productoInsumoId: i.productoInsumoId,
          nombre: i.productoInsumoNombre,
          cantidad: i.cantidad,
        }))
      : [
          {
            productoInsumoId: p.productoInsumoId,
            nombre: p.productoInsumoNombre || '',
            cantidad: p.cantidadInsumo,
          },
        ];
    this.prep = {
      fecha: p.fecha,
      productoResultadoId: p.productoResultadoId,
      cantidadResultado: p.cantidadResultado,
      productoInsumoId: insumos[0]?.productoInsumoId ?? null,
      cantidadInsumo: insumos.reduce((s, i) => s + i.cantidad, 0),
      insumoNombre: insumos.map((i) => i.nombre).join(' + '),
      insumos,
    };
    setTimeout(() => {
      document.querySelector('.panel-prep')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  cancelarEdicionPrep(): void {
    this.editandoPrepId = null;
    this.errorPrep = '';
    this.okPrep = '';
    this.prep = {
      fecha: this.hoyLocal(),
      productoResultadoId: null,
      cantidadResultado: null,
      productoInsumoId: null,
      cantidadInsumo: null,
      insumoNombre: '',
      insumos: [],
    };
    this.asegurarFechaValida();
  }

  guardarPreparacion(): void {
    this.errorPrep = '';
    this.okPrep = '';
    this.asegurarFechaValida();
    if (!this.validarFecha(this.prep.fecha, 'errorPrep')) return;
    this.recalcularInsumoPrep();
    const cantRes = Number(this.prep.cantidadResultado);
    if (
      this.prep.productoResultadoId == null ||
      !this.prep.insumos.length ||
      !Number.isFinite(cantRes) ||
      cantRes <= 0
    ) {
      this.errorPrep = 'Completa producto y cantidad preparada';
      return;
    }
    if (this.excedeStockInsumoPrep) {
      this.errorPrep = `No hay suficiente insumo: ${this.insumosFaltantesPrep()}`;
      return;
    }
    const body = {
      fecha: this.prep.fecha,
      productoResultadoId: this.prep.productoResultadoId,
      cantidadResultado: cantRes,
      insumos: this.prep.insumos.map((i) => ({
        productoInsumoId: i.productoInsumoId,
        cantidad: i.cantidad,
      })),
    };
    const resumen = this.prep.insumos.map((i) => `${i.cantidad} L ${i.nombre}`).join(' + ');
    const editId = this.editandoPrepId;
    const req$ =
      editId != null
        ? this.api.actualizarProduccion(editId, body)
        : this.api.crearProduccion(body);
    req$.subscribe({
      next: () => {
        const msg =
          editId != null
            ? 'Preparación actualizada'
            : `Listo: +${cantRes} L y se descontó ${resumen}`;
        this.cancelarEdicionPrep();
        this.okPrep = msg;
        this.persistirBorrador();
        this.cargar();
      },
      error: (e) =>
        (this.errorPrep =
          e.error?.error ||
          (editId != null ? 'Error al actualizar preparación' : 'Error al registrar preparación')),
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta entrada?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    if (this.editandoEntradaId === id) this.cancelarEdicionEntrada();
    this.api.eliminarEntrada(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }

  async eliminarProduccion(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta preparación?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    if (this.editandoPrepId === id) this.cancelarEdicionPrep();
    this.api.eliminarProduccion(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.errorPrep = e.error?.error || 'Error al eliminar'),
    });
  }

  private lineaConDatos(l: LineaForm): boolean {
    return (
      l.productoId != null ||
      l.tambienTraspasar ||
      (l.cantidad != null && Number(l.cantidad) !== 0) ||
      (l.precioProveedor != null && String(l.precioProveedor) !== '') ||
      (l.totalPagado != null && String(l.totalPagado) !== '') ||
      (l.cantidadTraspaso != null && Number(l.cantidadTraspaso) !== 0)
    );
  }

  private prepConDatos(): boolean {
    if (this.editandoPrepId != null) return false;
    return (
      this.prep.productoResultadoId != null ||
      this.prep.productoInsumoId != null ||
      (this.prep.cantidadResultado != null && Number(this.prep.cantidadResultado) !== 0) ||
      (this.prep.cantidadInsumo != null && Number(this.prep.cantidadInsumo) !== 0)
    );
  }

  private hayBorradorUtil(): boolean {
    return (
      this.lineas.some((l) => this.lineaConDatos(l)) ||
      !!this.traspasoPersona.trim() ||
      this.prepConDatos()
    );
  }

  programarBorrador(): void {
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.persistirBorrador(), 200);
  }

  private persistirBorrador(): void {
    if (!this.hayBorradorUtil()) {
      this.drafts.clear(EntradasComponent.DRAFT);
      return;
    }
    const draft: DraftEntradas = {
      fecha: this.fecha,
      nextKey: this.nextKey,
      traspasoPersona: this.traspasoPersona,
      lineas: this.lineas.map(
        ({ productoId, cantidad, precioProveedor, totalPagado, tambienTraspasar, cantidadTraspaso }) => ({
          productoId,
          cantidad,
          precioProveedor,
          totalPagado,
          tambienTraspasar,
          cantidadTraspaso,
        })
      ),
      prep: { ...this.prep },
    };
    this.drafts.save(EntradasComponent.DRAFT, draft);
  }

  private restaurarBorrador(): void {
    const draft = this.drafts.load<DraftEntradas>(EntradasComponent.DRAFT);
    if (!draft) return;
    if (draft.fecha) this.fecha = draft.fecha;
    this.traspasoPersona = draft.traspasoPersona || '';
    this.nextKey = Math.max(1, Number(draft.nextKey) || 1);
    if (draft.lineas?.length) {
      const legacyGlobal = !!draft.tambienTraspasar;
      this.lineas = draft.lineas.map((l) => {
        const cantTr = l.cantidadTraspaso ?? null;
        const porLinea =
          typeof l.tambienTraspasar === 'boolean'
            ? l.tambienTraspasar
            : legacyGlobal || (cantTr != null && Number(cantTr) > 0);
        return {
          key: this.nextKey++,
          productoId: l.productoId ?? null,
          cantidad: l.cantidad ?? null,
          precioProveedor: l.precioProveedor ?? null,
          totalPagado:
            l.totalPagado != null
              ? l.totalPagado
              : (() => {
                  const cant = Number(l.cantidad);
                  const precio = Number(l.precioProveedor);
                  if (
                    Number.isFinite(cant) &&
                    cant > 0 &&
                    Number.isFinite(precio) &&
                    precio >= 0 &&
                    l.precioProveedor != null
                  ) {
                    return Math.round(cant * precio * 100) / 100;
                  }
                  return null;
                })(),
          tambienTraspasar: porLinea,
          cantidadTraspaso: cantTr,
        };
      });
    }
    if (draft.prep && (draft.prep.productoResultadoId != null || draft.prep.cantidadResultado != null)) {
      this.prep = {
        fecha: draft.prep.fecha || this.hoyLocal(),
        productoResultadoId: draft.prep.productoResultadoId ?? null,
        cantidadResultado: draft.prep.cantidadResultado ?? null,
        productoInsumoId: draft.prep.productoInsumoId ?? null,
        cantidadInsumo: draft.prep.cantidadInsumo ?? null,
        insumoNombre: draft.prep.insumoNombre || '',
        insumos: draft.prep.insumos || [],
      };
      this.prepAbierta = true;
    }
  }
}
