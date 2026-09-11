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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { CapturaDraftService } from '../../captura-draft.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { ClearableDirective } from '../../clearable.directive';
import { InventarioItem, MODOS_VENTA, ModoVenta, TipoVenta, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import { PullRefreshService } from '../../pull-refresh.service';
import { capturaLineasVacias, PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { RouterLink } from '@angular/router';

interface LineaVenta {
  key: number;
  /** Captura en UI; Menudeo se resuelve a Litros/Pieza según el producto. */
  modo: ModoVenta;
  productoId: number | null;
  cantidad: number | null;
  precioManual: number | null;
  total: number | null;
}

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
    FormsModule,
    RouterLink,
    ProductoAutocompleteComponent,
    FechaDmYPipe,
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
  filtro = '';
  /** Texto del buscador; el filtro de lista se aplica con debounce. */
  filtroTexto = '';
  /** Resultados filtrados (cache). */
  filtradas: Venta[] = [];
  pagHist = new PaginacionEstado<Venta>();
  /** Historial: solo el día de la fecha de captura, o todo. */
  soloHoy = true;
  guardando = false;
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  private fechasCorte = new Set<string>();
  private idMarcadoresCorte = new Set<number>();
  lineas: LineaVenta[] = [];
  private nextKey = 1;
  private pullSub?: Subscription;
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;
  private idsPreparables = new Set<number>();

  @ViewChild('listaHistorial') listaHistorial?: ElementRef<HTMLElement>;
  @ViewChildren(ProductoAutocompleteComponent) prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;

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
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.persistirBorrador();
    this.pullSub?.unsubscribe();
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
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
      base = base.filter((v) => (v.productoNombre ?? '').toLowerCase().includes(q));
    }
    this.filtradas = [...base].sort((a, b) => {
      const porFecha = b.fecha.localeCompare(a.fecha);
      return porFecha !== 0 ? porFecha : b.id - a.id;
    });
    this.pagHist.setItems(this.filtradas, reset);
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
    setTimeout(() => {
      this.listaHistorial?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
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
    l.modo = modo;
    if (modo !== 'MAYOREO') {
      l.precioManual = null;
      l.total = null;
    } else {
      this.sugerirTotalMayoreo(l);
    }
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
    this.cdr.detectChanges();
    setTimeout(() => this.focusProducto(this.lineas.length - 1), 0);
  }

  onProductoEnter(index: number): void {
    setTimeout(() => this.focusCantidad(index), 0);
  }

  onCantidadEnter(ev: Event, index: number): void {
    ev.preventDefault();
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      return;
    }
    setTimeout(() => this.focusProducto(irA), 0);
  }

  private focusProducto(index: number): void {
    this.prodAutos?.get(index)?.focus();
  }

  private focusCantidad(index: number): void {
    const el = this.cantInputs?.get(index)?.nativeElement;
    if (!el) return;
    el.focus();
    el.select();
  }

  quitarLinea(index: number): void {
    const min = capturaLineasVacias();
    if (this.lineas.length <= min) {
      this.lineas[index] = this.nuevaLinea();
      if (this.lineas.length < min) this.resetLineas(min);
      return;
    }
    this.lineas.splice(index, 1);
  }

  guardarTodas(): void {
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

    this.guardando = true;
    this.api
      .crearVentasLote({
        fecha: this.fecha,
        lineas: pendientes.map((l) => ({
          productoId: l.productoId,
          tipoVenta: this.tipoVentaEfectivo(l),
          cantidad: Number(l.cantidad),
          total: this.totalParaGuardar(l),
        })),
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          this.drafts.clear(VentasComponent.DRAFT);
          this.resetLineas(capturaLineasVacias());
          this.cargar();
          setTimeout(() => this.focusProducto(0), 50);
        },
        error: (e) => {
          this.guardando = false;
          this.error = e.error?.error || 'Error al guardar. Revisa las filas e intenta de nuevo.';
          this.persistirBorrador();
          this.cargar();
        },
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta venta?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarVenta(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
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
    };
  }

  private hayBorradorUtil(): boolean {
    return this.lineas.some((l) => this.tieneDatos(l));
  }

  private persistirBorrador(): void {
    if (!this.hayBorradorUtil()) {
      this.drafts.clear(VentasComponent.DRAFT);
      return;
    }
    const draft: DraftVentas = {
      fecha: this.fecha,
      nextKey: this.nextKey,
      lineas: this.lineas.map(({ modo, productoId, cantidad, precioManual, total }) => ({
        modo,
        productoId,
        cantidad,
        precioManual,
        total,
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
    }));
    return this.hayBorradorUtil();
  }
}
