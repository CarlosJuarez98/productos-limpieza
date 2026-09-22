import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { CapturaDraftService } from '../../captura-draft.service';
import { elementoVisible } from '../../captura-focus.util';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { ClearableDirective } from '../../clearable.directive';
import { InventarioItem, MODOS_VENTA, ModoVenta, TipoVenta, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import { FechaDiaComponent } from '../../fecha-dia.component';
import { PullRefreshService } from '../../pull-refresh.service';
import { alinearLineasCaptura, capturaLineasVacias, PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { compartirTicketVenta } from '../../ticket-whatsapp.util';
import { RouterLink } from '@angular/router';

interface LineaVenta {
  key: number;
  /** Captura en UI; Menudeo se resuelve a Litros/Pieza según el producto. */
  modo: ModoVenta;
  productoId: number | null;
  cantidad: number | null;
  precioManual: number | null;
  total: number | null;
  pagoTarjeta: boolean;
}

type FormEditVenta = {
  fecha: string;
  productoId: number | null;
  modo: ModoVenta;
  cantidad: number | null;
  precioManual: number | null;
  total: number | null;
  pagoTarjeta: boolean;
};

type DraftVentas = {
  fecha: string;
  lineas: Omit<LineaVenta, 'key'>[];
  nextKey: number;
};

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    ProductoAutocompleteComponent,
    FechaDmYPipe,
    FechaDiaComponent,
    ClearableDirective,
    PaginadorComponent,
  ],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.scss',
})
export class VentasComponent implements OnInit, OnDestroy {
  private static readonly DRAFT = 'ventas';

  ventas: Venta[] = [];
  productos: InventarioItem[] = [];
  modos = MODOS_VENTA;
  error = '';
  ok = '';
  filtro = '';
  /** Texto del buscador; el filtro de lista se aplica con debounce. */
  filtroTexto = '';
  /** Resultados filtrados (cache). */
  filtradas: Venta[] = [];
  /** Ids de la última línea de cada folio/día (único botón ticket + etiqueta folio). */
  private ticketFolioIds = new Set<number>();
  pagHist = new PaginacionEstado<Venta>();
  /** Historial: solo el día de la fecha de captura, o todo. */
  soloHoy = true;
  guardando = false;
  /** Id de venta cuyo ticket se está generando. */
  ticketVentaId: number | null = null;
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  private fechasCorte = new Set<string>();
  private idMarcadoresCorte = new Set<number>();
  lineas: LineaVenta[] = [];
  private nextKey = 1;
  private pullSub?: Subscription;
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private idsPreparables = new Set<number>();

  @ViewChild('capturaPanel') capturaPanel?: ElementRef<HTMLElement>;
  @ViewChild('listaHistorial') listaHistorial?: ElementRef<HTMLElement>;
  @ViewChildren(ProductoAutocompleteComponent) prodAutos!: QueryList<ProductoAutocompleteComponent>;

  editandoId: number | null = null;
  formEdit: FormEditVenta = this.formEditVacio();
  guardandoEdit = false;
  errorEdit = '';

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private pullRefresh: PullRefreshService,
    private drafts: CapturaDraftService
  ) {}

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
  }

  ngOnInit(): void {
    if (!this.restaurarBorrador()) this.resetLineas(capturaLineasVacias());
    this.alinearLineasViewport();
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.persistirBorrador();
    this.pullSub?.unsubscribe();
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
    if (this.focusTimer != null) clearTimeout(this.focusTimer);
  }

  @HostListener('window:resize')
  onResizeCaptura(): void {
    this.alinearLineasViewport();
  }

  private alinearLineasViewport(): void {
    this.lineas = alinearLineasCaptura(
      this.lineas,
      (l) => !this.tieneDatos(l),
      () => this.nuevaLinea()
    );
  }

  @HostListener('window:pagehide')
  @HostListener('document:visibilitychange')
  onGuardarBorrador(): void {
    this.persistirBorrador();
  }

  private rebuildFiltradas(reset = false): void {
    const q = this.filtro.trim().toLowerCase();
    const sinCasa = this.ventas.filter((v) => v.tipoVenta !== 'CASA');
    let base = sinCasa;
    if (this.soloHoy) {
      base = base.filter((v) => v.fecha === this.fecha);
    }
    if (q) {
      const folioQ = Number(q.replace(/^#/, ''));
      base = base.filter((v) => {
        const nom = (v.productoNombre ?? '').toLowerCase().includes(q);
        const folioHit =
          Number.isFinite(folioQ) && folioQ > 0 && v.folio != null && Number(v.folio) === folioQ;
        return nom || folioHit || String(v.folio ?? '').includes(q);
      });
    }
    this.filtradas = [...base].sort((a, b) => {
      const porFecha = b.fecha.localeCompare(a.fecha);
      return porFecha !== 0 ? porFecha : b.id - a.id;
    });
    this.recalcularTicketFolioIds();
    this.pagHist.setItems(this.filtradas, reset);
  }

  /** Una sola fila por folio del día: la última línea del ticket (mayor id = arriba en la lista). */
  private recalcularTicketFolioIds(): void {
    const best = new Map<string, number>();
    // Lista va fecha↓ id↓: la última del ticket queda arriba (Axion, etc.).
    for (const v of this.filtradas) {
      if (v.folio == null) {
        best.set(`id:${v.id}`, v.id);
        continue;
      }
      const key = `${v.fecha}|${Number(v.folio)}`;
      const prev = best.get(key);
      if (prev == null || v.id > prev) best.set(key, v.id);
    }
    this.ticketFolioIds = new Set(best.values());
  }

  onFiltroTexto(value: string): void {
    this.filtroTexto = value;
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
    this.filtroTimer = setTimeout(() => {
      this.filtroTimer = null;
      this.filtro = this.filtroTexto;
      this.rebuildFiltradas(true);
    }, 200);
  }

  aplicarBusqueda(): void {
    if (this.filtroTimer != null) {
      clearTimeout(this.filtroTimer);
      this.filtroTimer = null;
    }
    this.filtro = this.filtroTexto;
    this.rebuildFiltradas(true);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setTimeout(() => this.scrollHistorial(), 50);
  }

  onBuscarEnter(ev: Event): void {
    ev.preventDefault();
    this.aplicarBusqueda();
  }

  setSoloHoy(val: boolean): void {
    this.soloHoy = val;
    this.rebuildFiltradas(true);
  }

  onFechaChange(): void {
    if (this.soloHoy) this.rebuildFiltradas(true);
    this.programarBorrador();
  }

  paginaAnterior(): void {
    if (!this.pagHist.anterior()) return;
    this.scrollHistorial();
  }

  paginaSiguiente(): void {
    if (!this.pagHist.siguiente()) return;
    this.scrollHistorial();
  }

  private scrollHistorial(): void {
    const irArriba = () => {
      const ancla =
        this.listaHistorial?.nativeElement || document.getElementById('ventas-hist-top');
      if (!ancla) return;
      ancla.querySelectorAll('.table-wrap, .hist-cards').forEach((el) => {
        if (el instanceof HTMLElement) el.scrollTop = 0;
      });
      const main = document.querySelector('main') as HTMLElement | null;
      if (main) {
        const y =
          ancla.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 8;
        main.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      } else {
        ancla.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    };
    setTimeout(irArriba, 0);
    setTimeout(irArriba, 80);
    setTimeout(irArriba, 200);
  }

  /** Hay ventas en el filtro de día/todas (sin buscar). */
  get hayVentasParaBuscar(): boolean {
    const sinCasa = this.ventas.filter((v) => v.tipoVenta !== 'CASA');
    if (this.soloHoy) {
      return sinCasa.some((v) => v.fecha === this.fecha);
    }
    return sinCasa.length > 0;
  }

  /** Suma de ventas del día de captura (ya guardadas). */
  get totalVentasDia(): number {
    return (
      Math.round(
        this.ventas
          .filter((v) => v.tipoVenta !== 'CASA' && v.fecha === this.fecha)
          .reduce((s, v) => s + (Number(v.total) || 0), 0) * 100
      ) / 100
    );
  }

  /** Total del ticket en captura (aún no guardado). */
  get totalTicket(): number {
    return (
      Math.round(
        this.lineas.reduce((s, l) => {
          if (!this.tieneDatos(l) || l.productoId == null) return s;
          const t = this.totalEstimado(l);
          return s + (t != null ? t : 0);
        }, 0) * 100
      ) / 100
    );
  }

  get lineasConDatos(): number {
    return this.lineas.filter((l) => this.tieneDatos(l) && l.productoId != null).length;
  }

  get etiquetaGuardar(): string {
    if (this.guardando) return 'Guardando…';
    const pendientes = this.lineas.filter((l) => this.tieneDatos(l) && l.productoId != null);
    const soloCasa = pendientes.length > 0 && pendientes.every((l) => l.modo === 'CASA');
    if (soloCasa) {
      return pendientes.length <= 1 ? 'Registrar uso en casa' : 'Registrar usos en casa';
    }
    const soloMuestra = pendientes.length > 0 && pendientes.every((l) => l.modo === 'MUESTRA');
    if (soloMuestra) {
      const costo = this.costoTicketSinCobro;
      const base = pendientes.length <= 1 ? 'Registrar muestra' : 'Registrar muestras';
      return costo > 0 ? `${base} · nos cuesta $${costo.toFixed(2)}` : base;
    }
    const base = pendientes.length <= 1 ? 'Guardar venta' : 'Guardar ventas';
    return `${base} · $${this.totalTicket.toFixed(2)}`;
  }

  /** Costo de compra de muestras/casa en el ticket (no se cobra, sí se pierde). */
  get costoTicketSinCobro(): number {
    return (
      Math.round(
        this.lineas.reduce((s, l) => {
          if (!this.tieneDatos(l) || l.productoId == null || !this.esSinCobro(l)) return s;
          const c = this.costoEstimado(l);
          return s + (c != null ? c : 0);
        }, 0) * 100
      ) / 100
    );
  }

  productoDe(l: LineaVenta): InventarioItem | undefined {
    return this.productos.find((x) => x.id === l.productoId);
  }

  productoPorId(id: number | null | undefined): InventarioItem | undefined {
    if (id == null) return undefined;
    return this.productos.find((x) => x.id === id);
  }

  stockDisponible(productoId: number | null): number | null {
    if (productoId == null) return null;
    const p = this.productoPorId(productoId);
    if (!p) return null;
    return Number(p.stockActual) || 0;
  }

  /**
   * Unidades físicas que pide la línea (en Pesos: $ / menudeo).
   */
  unidadesPedidas(l: LineaVenta): number {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return 0;
    if (l.modo === 'PESOS') {
      const precio = this.precioLista(l);
      if (precio <= 0) return 0;
      return cant / precio;
    }
    return cant;
  }

  unidadesPedidasOtros(productoId: number, exceptoIndex: number): number {
    return this.lineas.reduce((s, l, i) => {
      if (i === exceptoIndex || l.productoId !== productoId) return s;
      return s + this.unidadesPedidas(l);
    }, 0);
  }

  excedeStock(l: LineaVenta, index: number): boolean {
    if (l.productoId == null) return false;
    const stock = this.stockDisponible(l.productoId);
    if (stock == null) return false;
    const pedidas = this.unidadesPedidas(l);
    if (pedidas <= 0) return false;
    return pedidas + this.unidadesPedidasOtros(l.productoId, index) > stock + 1e-9;
  }

  get hayExcesoStock(): boolean {
    return this.lineas.some((l, i) => this.excedeStock(l, i) && this.tieneDatos(l));
  }

  avisoStock(l: LineaVenta, _index: number): string | null {
    if (!this.excedeStock(l, _index)) return null;
    const nombre = this.productoDe(l)?.nombre || 'este producto';
    return `No tienes suficiente ${nombre}.`;
  }

  /** Productos con fórmula de preparación. */
  esPreparable(l: LineaVenta): boolean {
    return l.productoId != null && this.idsPreparables.has(l.productoId);
  }

  unidadDe(l: LineaVenta): string {
    if (l.modo === 'PESOS') return '$';
    const p = this.productoDe(l);
    return p?.vendePor === 'PIEZA' ? 'pza' : 'L';
  }

  /** Tipo real que se guarda en BD (menudeo → Litros/Pieza del producto). */
  tipoVentaEfectivo(l: LineaVenta): TipoVenta {
    if (l.modo === 'MENUDEO') {
      return this.productoDe(l)?.vendePor === 'PIEZA' ? 'PIEZA' : 'LITROS';
    }
    return l.modo;
  }

  esMayoreo(l: LineaVenta): boolean {
    return l.modo === 'MAYOREO';
  }

  /** Muestra / Casa: no se cobra, pero sí sale del inventario y tiene costo. */
  esSinCobro(l: LineaVenta): boolean {
    return l.modo === 'MUESTRA' || l.modo === 'CASA';
  }

  esVentaSinCobro(v: Venta): boolean {
    return v.tipoVenta === 'MUESTRA' || v.tipoVenta === 'CASA';
  }

  permitePrecioManual(l: LineaVenta): boolean {
    return l.modo === 'MAYOREO';
  }

  muestraPrecioLista(l: LineaVenta): boolean {
    return l.modo === 'MENUDEO';
  }

  tienePrecioManual(l: LineaVenta): boolean {
    return l.precioManual != null && String(l.precioManual) !== '' && Number(l.precioManual) > 0;
  }

  precioLista(l: LineaVenta): number {
    const p = this.productoDe(l);
    return p ? Number(p.precioVentaHoy) || 0 : 0;
  }

  precioCompraDe(l: LineaVenta): number {
    const p = this.productoDe(l);
    return p ? Number(p.precioCompra) || 0 : 0;
  }

  /** Costo de mercancía (cant × compra) para muestra/casa. */
  costoEstimado(l: LineaVenta): number | null {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0 || l.productoId == null) return null;
    const compra = this.precioCompraDe(l);
    if (compra <= 0) return null;
    return Math.round(cant * compra * 100) / 100;
  }

  /** Costo histórico de una venta muestra/casa (desde inventario actual). */
  costoVenta(v: Venta): number | null {
    if (v.tipoVenta !== 'MUESTRA' && v.tipoVenta !== 'CASA') return null;
    const p = this.productoPorId(v.productoId);
    if (!p) return null;
    const compra = Number(p.precioCompra) || 0;
    const cant = Number(v.cantidad) || 0;
    if (compra <= 0 || cant <= 0) return null;
    return Math.round(cant * compra * 100) / 100;
  }

  totalEstimado(l: LineaVenta): number | null {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return null;
    const tipo = this.tipoVentaEfectivo(l);

    if (tipo === 'MUESTRA' || tipo === 'CASA') return 0;
    if (tipo === 'PESOS') return Math.round(cant * 100) / 100;

    if (tipo === 'MAYOREO') {
      if (this.tienePrecioManual(l)) {
        return Math.round(Number(l.precioManual) * cant * 100) / 100;
      }
      if (l.total != null && Number(l.total) > 0) {
        return Math.round(Number(l.total) * 100) / 100;
      }
      const unitMay = this.precioUnitarioMayoreo(l);
      return unitMay > 0 ? Math.round(unitMay * cant * 100) / 100 : null;
    }

    if (l.productoId == null) return null;
    const unit = this.precioLista(l);
    return unit > 0 ? Math.round(unit * cant * 100) / 100 : null;
  }

  precioUnitarioMayoreo(l: LineaVenta): number {
    const p = this.productoDe(l);
    if (!p) return 0;
    const cant = Number(l.cantidad) || 0;
    if (cant >= 10) return Number(p.precioMayoreo10) || Number(p.precioVentaHoy) || 0;
    if (cant >= 5) return Number(p.precioMayoreo5) || Number(p.precioVentaHoy) || 0;
    return Number(p.precioVentaHoy) || 0;
  }

  private fmtMoney(n: number): string {
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Pista del precio unitario mayoreo (≥5 / ≥10). */
  pistaPrecioMayoreo(l: LineaVenta): string {
    const p = this.productoDe(l);
    if (!p) return 'unitario';
    const m5 = Number(p.precioMayoreo5) || 0;
    const m10 = Number(p.precioMayoreo10) || 0;
    const partes: string[] = [];
    if (m5 > 0) partes.push(`≥5 $${this.fmtMoney(m5)}`);
    if (m10 > 0) partes.push(`≥10 $${this.fmtMoney(m10)}`);
    return partes.length ? partes.join(' · ') : 'unitario';
  }

  /** Pista del total: según cantidad, o totales de referencia 5 L / 10 L. */
  pistaTotalMayoreo(l: LineaVenta): string {
    const p = this.productoDe(l);
    if (!p) return '0';
    const cant = Number(l.cantidad) || 0;
    const m5 = Number(p.precioMayoreo5) || 0;
    const m10 = Number(p.precioMayoreo10) || 0;
    if (cant >= 5) {
      const unit = this.precioUnitarioMayoreo(l);
      if (unit > 0) {
        const tramo = cant >= 10 ? '≥10' : '≥5';
        return `${tramo} ≈ $${this.fmtMoney(unit * cant)}`;
      }
    }
    const partes: string[] = [];
    if (m5 > 0) partes.push(`5L $${this.fmtMoney(m5 * 5)}`);
    if (m10 > 0) partes.push(`10L $${this.fmtMoney(m10 * 10)}`);
    return partes.length ? partes.join(' · ') : '0';
  }

  tituloPistaMayoreo(l: LineaVenta): string {
    const p = this.productoDe(l);
    if (!p) return 'Precios de mayoreo del producto';
    const m5 = Number(p.precioMayoreo5) || 0;
    const m10 = Number(p.precioMayoreo10) || 0;
    const u = p.vendePor === 'PIEZA' ? 'pza' : 'L';
    const lineas: string[] = [];
    if (m5 > 0) {
      lineas.push(`≥5 ${u}: $${this.fmtMoney(m5)} c/u (5 → $${this.fmtMoney(m5 * 5)})`);
    }
    if (m10 > 0) {
      lineas.push(`≥10 ${u}: $${this.fmtMoney(m10)} c/u (10 → $${this.fmtMoney(m10 * 10)})`);
    }
    lineas.push('Si dejas el precio vacío, se usa el tramo según la cantidad.');
    return lineas.join('\n');
  }

  sugerirTotalMayoreo(l: LineaVenta): void {
    if (!this.esMayoreo(l) || this.tienePrecioManual(l)) return;
    if (l.productoId == null || l.cantidad == null) return;
    const unit = this.precioUnitarioMayoreo(l);
    const cant = Number(l.cantidad);
    if (unit > 0 && cant > 0) {
      l.total = Math.round(unit * cant * 100) / 100;
    }
  }

  setModo(l: LineaVenta, modo: ModoVenta): void {
    const activeId = (document.activeElement as HTMLElement | null)?.id || '';
    const enEstaLinea =
      activeId === `cant-${l.key}` ||
      activeId === `precio-${l.key}` ||
      activeId === `total-${l.key}`;
    l.modo = modo;
    if (this.esSinCobro(l)) l.pagoTarjeta = false;
    if (modo !== 'MAYOREO') {
      l.precioManual = null;
      l.total = null;
    } else {
      this.sugerirTotalMayoreo(l);
    }
    this.programarBorrador();
    if (!enEstaLinea) return;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (activeId.startsWith('precio-') && this.focusById(`precio-${l.key}`)) return;
      if (activeId.startsWith('total-') && this.focusById(`total-${l.key}`)) return;
      this.focusById(`cant-${l.key}`);
    }, 0);
  }

  get lineaEdit(): LineaVenta {
    return {
      key: 0,
      modo: this.formEdit.modo,
      productoId: this.formEdit.productoId,
      cantidad: this.formEdit.cantidad,
      precioManual: this.formEdit.precioManual,
      total: this.formEdit.total,
      pagoTarjeta: this.formEdit.pagoTarjeta,
    };
  }

  totalParaGuardar(l: LineaVenta): number | null {
    const tipo = this.tipoVentaEfectivo(l);
    if (tipo === 'LITROS' || tipo === 'PIEZA') return null;
    if (this.tienePrecioManual(l)) {
      const t = this.totalEstimado(l);
      return t != null ? t : null;
    }
    if (tipo === 'MAYOREO' && l.total != null && Number(l.total) > 0) {
      return Number(l.total);
    }
    return null;
  }

  cargar(): void {
    this.api.ventas().subscribe({
      next: (v) => {
        this.ventas = v;
        this.recalcularMarcadoresCorte();
        this.rebuildFiltradas();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar ventas'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
    this.api.recetas().subscribe({
      next: (lista) => {
        this.idsPreparables = new Set((lista || []).map((r) => r.productoResultadoId));
      },
      error: () => {
        this.idsPreparables = new Set();
      },
    });
    this.api.caja().subscribe({
      next: (c) => {
        this.fechaMin = c.fechaInicio || null;
        this.fechaUltimoCorte =
          c.fechaUltimoCorte || (c.fechaInicio ? this.sumarDias(c.fechaInicio, -1) : null);
        this.fechasCorte = new Set(c.fechasCorte || []);
        this.asegurarFechaValida();
        this.recalcularMarcadoresCorte();
      },
    });
  }

  esRegistroCorte(v: Venta): boolean {
    return this.idMarcadoresCorte.has(v.id);
  }

  private recalcularMarcadoresCorte(): void {
    this.idMarcadoresCorte.clear();
    if (this.fechasCorte.size === 0 || this.ventas.length === 0) return;
    for (const fecha of this.fechasCorte) {
      const delDia = this.ventas.filter((v) => v.fecha === fecha);
      if (delDia.length === 0) continue;
      const ultimo = delDia.reduce((a, b) => (a.id > b.id ? a : b));
      this.idMarcadoresCorte.add(ultimo.id);
    }
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.programarBorrador();
    this.cdr.detectChanges();
    this.enfocarCaptura(this.lineas.length - 1, 'producto');
  }

  onFechaEnter(_ev?: Event): void {
    this.enfocarCaptura(0, 'producto');
  }

  onProductoEnter(index: number): void {
    this.avanzarDesde(index, 'producto');
  }

  onCampoEnter(ev: Event, index: number, campo: 'cantidad' | 'precio' | 'total'): void {
    ev.preventDefault();
    this.programarBorrador();
    this.avanzarDesde(index, campo);
  }

  private avanzarDesde(index: number, desde: 'producto' | 'cantidad' | 'precio' | 'total'): void {
    const l = this.lineas[index];
    if (!l) {
      this.agregarLinea();
      return;
    }
    if (desde === 'producto') {
      this.enfocarCaptura(index, 'cantidad');
      return;
    }
    if (desde === 'cantidad' && this.permitePrecioManual(l)) {
      if (this.focusById('precio-' + l.key)) return;
    }
    if ((desde === 'cantidad' || desde === 'precio') && this.esMayoreo(l) && !this.tienePrecioManual(l)) {
      if (this.focusById('total-' + l.key)) return;
    }
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      return;
    }
    this.enfocarCaptura(irA, 'producto');
  }

  private autosCaptura(): ProductoAutocompleteComponent[] {
    return (this.prodAutos?.toArray() || []).filter(
      (a) => !!a.inputName?.startsWith('prod') && !a.inputName.startsWith('edit')
    );
  }

  private enfocarCaptura(index: number, campo: 'producto' | 'cantidad'): void {
    const go = () => {
      if (campo === 'cantidad') {
        if (!this.focusById('cant-' + (this.lineas[index]?.key ?? ''))) {
          this.autosCaptura()[index]?.focus();
        }
      } else {
        this.autosCaptura()[index]?.focus();
      }
      this.scrollLineaVisible(index);
    };
    if (this.focusTimer != null) clearTimeout(this.focusTimer);
    this.cdr.detectChanges();
    this.focusTimer = setTimeout(go, 60);
    setTimeout(go, 220);
  }

  private scrollLineaVisible(index: number): void {
    const l = this.lineas[index];
    if (!l) return;
    document.getElementById('linea-' + l.key)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private focusById(id: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el || !elementoVisible(el)) return false;
    el.focus({ preventScroll: true });
    el.select();
    return true;
  }

  toggleTarjeta(l: LineaVenta): void {
    if (this.esSinCobro(l)) return;
    l.pagoTarjeta = !l.pagoTarjeta;
    this.programarBorrador();
  }

  private formEditVacio(): FormEditVenta {
    return {
      fecha: this.hoyLocal(),
      productoId: null,
      modo: 'MENUDEO',
      cantidad: null,
      precioManual: null,
      total: null,
      pagoTarjeta: false,
    };
  }

  modoDeVenta(v: Venta): ModoVenta {
    if (v.tipoVenta === 'LITROS' || v.tipoVenta === 'PIEZA') return 'MENUDEO';
    return v.tipoVenta as ModoVenta;
  }

  editarVenta(v: Venta): void {
    if (this.esRegistroCorte(v)) return;
    this.editandoId = v.id;
    this.errorEdit = '';
    const modo = this.modoDeVenta(v);
    const cant = Number(v.cantidad);
    const total = Number(v.total);
    const precioManual =
      modo === 'MAYOREO' && cant > 0 && total > 0 ? Math.round((total / cant) * 100) / 100 : null;
    this.formEdit = {
      fecha: v.fecha,
      productoId: v.productoId,
      modo,
      cantidad: cant,
      precioManual,
      total: modo === 'MAYOREO' ? total : null,
      pagoTarjeta: !!v.pagoTarjeta,
    };
    this.scrollAEdicion(v.id);
  }

  cancelarEdicion(): void {
    const id = this.editandoId;
    this.editandoId = null;
    this.formEdit = this.formEditVacio();
    this.errorEdit = '';
    this.guardandoEdit = false;
    if (id != null) this.scrollAEdicion(id);
  }

  private scrollAEdicion(id: number): void {
    setTimeout(() => {
      const candidatos = [
        document.getElementById('edit-venta-desk-' + id),
        document.getElementById('edit-venta-movil-' + id),
        document.getElementById('venta-row-' + id),
        document.getElementById('venta-card-' + id),
      ];
      const el = candidatos.find((n) => n != null && this.estaVisible(n));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  private estaVisible(el: HTMLElement): boolean {
    if (el.getClientRects().length === 0) return false;
    let n: HTMLElement | null = el;
    while (n) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  }

  setModoEdit(modo: ModoVenta): void {
    this.formEdit.modo = modo;
    if (modo === 'CASA' || modo === 'MUESTRA') this.formEdit.pagoTarjeta = false;
  }

  guardarEdicion(): void {
    if (this.editandoId == null) return;
    this.errorEdit = '';
    if (!this.formEdit.fecha) {
      this.errorEdit = 'Indica la fecha';
      return;
    }
    if (this.formEdit.fecha > this.hoyLocal()) {
      this.errorEdit = 'No se pueden registrar ventas con fecha futura';
      return;
    }
    if (this.fechaMin && this.formEdit.fecha < this.fechaMin) {
      this.errorEdit = `La fecha debe ser desde ${formatFechaDmY(this.fechaMin)}`;
      return;
    }
    if (this.formEdit.productoId == null) {
      this.errorEdit = 'Elige un producto';
      return;
    }
    const cant = Number(this.formEdit.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      this.errorEdit = 'La cantidad debe ser mayor a 0';
      return;
    }
    const linea: LineaVenta = {
      key: 0,
      modo: this.formEdit.modo,
      productoId: this.formEdit.productoId,
      cantidad: cant,
      precioManual: this.formEdit.precioManual,
      total: this.formEdit.total,
      pagoTarjeta: this.formEdit.pagoTarjeta,
    };
    this.guardandoEdit = true;
    this.api
      .actualizarVenta(this.editandoId, {
        fecha: this.formEdit.fecha,
        productoId: this.formEdit.productoId,
        tipoVenta: this.tipoVentaEfectivo(linea),
        cantidad: cant,
        total: this.totalParaGuardar(linea),
        pagoTarjeta: this.formEdit.pagoTarjeta && !this.esSinCobro(linea),
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          this.cancelarEdicion();
          this.cargar();
        },
        error: (e) => {
          this.guardandoEdit = false;
          this.errorEdit = e.error?.error || 'No se pudo guardar la venta';
        },
      });
  }

  get ticketEnCurso(): boolean {
    return this.hayBorradorUtil();
  }

  async cancelarTicket(): Promise<void> {
    if (!this.hayBorradorUtil()) return;
    const ok = await this.confirmDlg.ask(
      'Se borra todo el ticket. Las ventas ya registradas no se tocan.',
      { titulo: '¿Cancelar esta venta?', confirmarTexto: 'Sí, borrar ticket' }
    );
    if (!ok) return;
    this.error = '';
    this.drafts.clear(VentasComponent.DRAFT);
    this.resetLineas(capturaLineasVacias());
    setTimeout(() => {
      this.capturaPanel?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.enfocarCaptura(0, 'producto');
    }, 50);
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas[index] = this.nuevaLinea();
      this.alinearLineasViewport();
      return;
    }
    this.lineas.splice(index, 1);
    this.alinearLineasViewport();
  }

  async guardarTodas(): Promise<void> {
    this.error = '';
    if (!this.fecha) {
      this.error = 'Indica la fecha';
      return;
    }
    if (this.fecha > this.hoyLocal()) {
      this.error = 'No se pueden registrar ventas con fecha futura';
      return;
    }
    if (this.fechaUltimoCorte && this.fecha <= this.fechaUltimoCorte) {
      this.error = `No se pueden registrar ventas el ${formatFechaDmY(this.fechaUltimoCorte)} ni antes (ya hubo corte). Usa una fecha desde ${formatFechaDmY(this.fechaMin)}.`;
      return;
    }
    if (this.fechaMin && this.fecha < this.fechaMin) {
      this.error = `La fecha debe ser desde ${formatFechaDmY(this.fechaMin)} (día siguiente al último corte)`;
      return;
    }

    const pendientes = this.lineas.filter((l) => this.tieneDatos(l));
    if (pendientes.length === 0) {
      this.error = 'Agrega al menos una venta';
      return;
    }

    for (const l of pendientes) {
      if (l.cantidad == null || Number(l.cantidad) <= 0) {
        this.error = 'Cada venta necesita cantidad mayor a 0';
        return;
      }
      if (l.productoId == null) {
        this.error = 'Elige un producto del inventario en cada fila';
        return;
      }
      if (this.esMayoreo(l) && !this.tienePrecioManual(l)) {
        if (l.total == null || Number(l.total) <= 0) {
          this.sugerirTotalMayoreo(l);
        }
        if (l.total == null || Number(l.total) <= 0) {
          this.error = 'En mayoreo indica precio unitario, cantidad ≥5 o el total cobrado';
          return;
        }
      }
    }

    const exceso = this.lineas.findIndex((l, i) => this.excedeStock(l, i) && this.tieneDatos(l));
    if (exceso >= 0) {
      this.error =
        this.avisoStock(this.lineas[exceso], exceso) ||
        'Hay cantidades mayores al stock. Revisa Inventario, Surtir o Preparar.';
      return;
    }

    const ok = await this.confirmarTicket(pendientes);
    if (!ok) return;

    this.guardando = true;
    this.error = '';
    this.ok = '';

    this.api
      .crearVentasLote({
        fecha: this.fecha,
        lineas: pendientes.map((l) => ({
          productoId: l.productoId,
          productoNombre: this.productoPorId(l.productoId)?.nombre || undefined,
          tipoVenta: this.tipoVentaEfectivo(l),
          cantidad: Number(l.cantidad),
          total: this.totalParaGuardar(l),
          pagoTarjeta: l.pagoTarjeta && !this.esSinCobro(l),
        })),
      })
      .subscribe({
        next: (creadas) => {
          this.guardando = false;
          this.drafts.clear(VentasComponent.DRAFT);
          this.resetLineas(capturaLineasVacias());
          const folio = creadas?.[0]?.folio;
          this.ok =
            folio != null
              ? `Venta guardada · Folio #${folio}`
              : 'Venta guardada';
          this.cargar();
          setTimeout(() => {
            this.capturaPanel?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.enfocarCaptura(0, 'producto');
          }, 50);
        },
        error: (e) => {
          this.guardando = false;
          this.error = e.error?.error || 'Error al guardar. Revisa las filas e intenta de nuevo.';
          this.persistirBorrador();
          this.cargar();
        },
      });
  }

  /** Folio + 🎫 solo en la última línea del ticket (mismo folio y fecha). */
  esTicketFolioVisible(v: Venta): boolean {
    return this.ticketFolioIds.has(v.id);
  }

  async compartirTicketFolio(v: Venta): Promise<void> {
    this.error = '';
    this.ok = '';
    this.ticketVentaId = v.id;
    try {
      let lineasApi: Venta[];
      if (v.folio != null) {
        lineasApi = await new Promise<Venta[]>((resolve, reject) => {
          this.api.ventasPorFolio(v.folio!, v.fecha).subscribe({ next: resolve, error: reject });
        });
      } else {
        lineasApi = [v];
      }
      const lineas = lineasApi.map((x) => ({
        nombre: x.productoNombre || 'Producto',
        cantidad: Number(x.cantidad) || 0,
        unidad: x.tipoVenta === 'PIEZA' ? 'pza' : x.tipoVenta === 'PESOS' ? '$' : 'L',
        total: Number(x.total) || 0,
        sinCobro: x.tipoVenta === 'MUESTRA' || x.tipoVenta === 'CASA',
      }));
      const total =
        Math.round(lineas.reduce((s, l) => s + (l.sinCobro ? 0 : l.total), 0) * 100) / 100;
      const hayTarjeta = lineasApi.some(
        (x) => !!x.pagoTarjeta && x.tipoVenta !== 'MUESTRA' && x.tipoVenta !== 'CASA'
      );
      const folioTxt = v.folio != null ? String(v.folio) : '';
      const modo = await compartirTicketVenta({
        fecha: formatFechaDmY(lineasApi[0]?.fecha || v.fecha),
        folio: folioTxt,
        lineas,
        total,
        pagoTarjeta: hayTarjeta,
      });
      const etiqueta = folioTxt ? `folio #${folioTxt}` : 'venta';
      this.ok =
        modo === 'compartido'
          ? `Ticket ${etiqueta}: elige el chat`
          : `Ticket ${etiqueta} descargado`;
    } catch (e: unknown) {
      this.error =
        e && typeof e === 'object' && 'error' in e
          ? ((e as { error?: { error?: string } }).error?.error || 'No se pudo generar el ticket')
          : e instanceof Error
            ? e.message
            : 'No se pudo generar el ticket';
    } finally {
      this.ticketVentaId = null;
    }
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta venta?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarVenta(id).subscribe({
      next: () => {
        if (this.editandoId === id) this.cancelarEdicion();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }

  private async confirmarTicket(pendientes: LineaVenta[]): Promise<boolean> {
    const recuento = this.recuentoTicket(pendientes);
    const n = pendientes.filter((l) => l.productoId != null).length;
    return this.confirmDlg.ask(recuento, {
      titulo: n <= 1 ? '¿Guardar esta venta?' : '¿Guardar este ticket?',
      confirmarTexto: 'Guardar',
    });
  }

  private recuentoTicket(pendientes: LineaVenta[]): string {
    const lineas = pendientes.filter((l) => l.productoId != null);
    const max = 8;
    const filas = lineas.slice(0, max).map((l) => this.lineaRecuento(l));
    if (lineas.length > max) filas.push(`… y ${lineas.length - max} más`);
    const n = lineas.length;
    const partes = [`${n} ${n === 1 ? 'producto' : 'productos'}`];
    if (this.totalTicket > 0) partes.push(`$${this.fmtMoney(this.totalTicket)}`);
    const pie = [partes.join(' · ')];
    const costo = this.costoTicketSinCobro;
    if (costo > 0) pie.push(`Muestras / casa nos cuestan $${this.fmtMoney(costo)}`);
    const tarjeta = lineas.filter((l) => l.pagoTarjeta && !this.esSinCobro(l)).length;
    if (tarjeta) pie.push(`${tarjeta} con tarjeta (va al banco)`);
    if (this.fecha) pie.push(`Fecha ${formatFechaDmY(this.fecha)}`);
    return `${filas.join('\n')}\n\n${pie.join('\n')}`;
  }

  private lineaRecuento(l: LineaVenta): string {
    const nombre = this.productoDe(l)?.nombre || 'Producto';
    const cant = Number(l.cantidad) || 0;
    const cantTxt = Number.isInteger(cant) ? String(cant) : String(Math.round(cant * 1000) / 1000);
    const uni = this.unidadDe(l);
    const extras: string[] = [];
    if (l.modo !== 'MENUDEO') {
      extras.push(this.modos.find((m) => m.value === l.modo)?.label || l.modo);
    }
    if (l.pagoTarjeta && !this.esSinCobro(l)) extras.push('tarjeta');
    const tot = this.totalEstimado(l);
    const money = this.esSinCobro(l) ? 'sin cobro' : tot != null ? `$${this.fmtMoney(tot)}` : '';
    const extra = extras.length ? ` · ${extras.join(' · ')}` : '';
    return `${nombre}  ·  ${cantTxt} ${uni}  ·  ${money}${extra}`.trim();
  }

  private tieneDatos(l: LineaVenta): boolean {
    return (
      (l.cantidad != null && String(l.cantidad) !== '' && Number(l.cantidad) !== 0) ||
      (l.total != null && String(l.total) !== '' && Number(l.total) !== 0) ||
      this.tienePrecioManual(l) ||
      l.productoId != null
    );
  }

  private resetLineas(n: number): void {
    this.lineas = Array.from({ length: n }, () => this.nuevaLinea());
  }

  private nuevaLinea(): LineaVenta {
    return {
      key: this.nextKey++,
      modo: 'MENUDEO',
      productoId: null,
      cantidad: null,
      precioManual: null,
      total: null,
      pagoTarjeta: false,
    };
  }

  private hayBorradorUtil(): boolean {
    return this.lineas.some((l) => this.tieneDatos(l));
  }

  onLineaCambio(l: LineaVenta): void {
    this.sugerirTotalMayoreo(l);
    this.programarBorrador();
  }

  programarBorrador(): void {
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.persistirBorrador(), 200);
  }

  private persistirBorrador(): void {
    if (!this.hayBorradorUtil()) {
      this.drafts.clear(VentasComponent.DRAFT);
      return;
    }
    const draft: DraftVentas = {
      fecha: this.fecha,
      nextKey: this.nextKey,
      lineas: this.lineas.map(({ modo, productoId, cantidad, precioManual, total, pagoTarjeta }) => ({
        modo,
        productoId,
        cantidad,
        precioManual,
        total,
        pagoTarjeta,
      })),
    };
    this.drafts.save(VentasComponent.DRAFT, draft);
  }

  private restaurarBorrador(): boolean {
    const draft = this.drafts.load<DraftVentas>(VentasComponent.DRAFT);
    if (!draft?.lineas?.length) return false;
    this.fecha = draft.fecha || this.hoyLocal();
    this.nextKey = Math.max(1, Number(draft.nextKey) || 1);
    this.lineas = draft.lineas.map((l) => ({
      key: this.nextKey++,
      modo: l.modo || 'MENUDEO',
      productoId: l.productoId ?? null,
      cantidad: l.cantidad ?? null,
      precioManual: l.precioManual ?? null,
      total: l.total ?? null,
      pagoTarjeta: !!l.pagoTarjeta,
    }));
    return this.hayBorradorUtil();
  }
}
