import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { inferirDepartamento, InventarioItem, PedidoAbono, PedidoLinea, PedidoRegistrado, PedidoSugerido } from '../../modelos';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { PullRefreshService } from '../../pull-refresh.service';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { AutoHideDirective } from '../../auto-hide.directive';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDiaComponent } from '../../fecha-dia.component';
import { SoloNumerosDirective } from '../../solo-numeros.directive';

type LineaEditable = PedidoLinea & { pedir: number | null; incluido: boolean; extra?: boolean };
type ModoPeriodo = '4_semanas' | 'mes_pasado' | 'mes_actual' | 'custom';
type GrupoPedido = 'LIMPIEZA' | 'JARCERIA';
type FiltroDepto = 'todo' | 'limpieza' | 'jarceria';
type TipSurtirEstado = 'urgente' | 'pronto' | 'ok' | 'sin_dato';
type TipSurtir = {
  depto: GrupoPedido;
  titulo: string;
  ultimoIso: string | null;
  ultimoTexto: string;
  diasDesde: number | null;
  cicloDias: number | null;
  recomendadoIso: string | null;
  recomendadoTexto: string;
  estado: TipSurtirEstado;
  detalle: string;
};
type ReciboEdit = {
  itemId: number;
  productoId: number;
  productoNombre: string;
  pedida: number | null;
  pedidaInicial: number;
  recibidaInicial: number;
  recibida: number | null;
  /** Importe que cobra el proveedor por lo recibido (unitario = importe ÷ recibido). */
  totalPagado: number | null;
  /** Precio compra de catálogo (para sugerir total). */
  precioCompra: number | null;
  unidad: string;
  departamento: GrupoPedido;
};

@Component({
  selector: 'app-surtir',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ClearableDirective,
    SoloNumerosDirective,
    PaginadorComponent,
    FechaDmYPipe,
    AutoHideDirective,
    ProductoAutocompleteComponent,
    FechaDiaComponent,
  ],
  templateUrl: './surtir.component.html',
  styleUrl: './surtir.component.scss',
})
export class SurtirComponent implements OnInit, OnDestroy {
  error = '';
  ok = '';
  cargando = false;
  registrando = false;
  porcentajeExtra = 20;
  readonly colchones = [0, 10, 20, 30, 40, 50] as const;
  modoPeriodo: ModoPeriodo = '4_semanas';
  filtroDepto: FiltroDepto = 'todo';
  desde = '';
  hasta = '';
  diasCobertura: number | null = null;
  lineas: LineaEditable[] = [];
  ultimo: PedidoSugerido | null = null;
  pedidos: PedidoRegistrado[] = [];
  pedidoExpandidoId: number | null = null;
  /** Edición de cantidades recibidas del pedido expandido. */
  recibosEdit: ReciboEdit[] = [];
  guardandoRecepcion = false;
  guardandoPedidaId: number | null = null;
  editandoPedidaId: number | null = null;
  productos: InventarioItem[] = [];
  saldoProductos = 0;
  altaProductoId: number | null = null;
  altaCantidad: number | null = null;
  altaPedidoProductoId: number | null = null;
  altaPedidoCantidad: number | null = null;
  pagadoAhora: number | null = null;
  fechaLimitePago = '';
  abonoNuevo = { fecha: '', monto: null as number | null, nota: '' };
  editandoAbonoId: number | null = null;
  editAbono = { fecha: '', monto: null as number | null, nota: '' };
  guardandoAbono = false;
  pagLitros = new PaginacionEstado<LineaEditable>(12);
  pagPiezas = new PaginacionEstado<LineaEditable>(12);
  tipsSurtir: TipSurtir[] = [];
  private pullSub?: Subscription;

  constructor(
    private api: ApiService,
    private pullRefresh: PullRefreshService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.aplicarModoPeriodo();
    this.cargarPedidos();
    this.cargarSaldoProductos();
    this.api.inventario().subscribe({
      next: (p) => {
        this.productos = p;
        this.recalcularTipsSurtir();
      },
      error: () => (this.productos = []),
    });
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => {
      this.cargarPedidos();
      this.cargarSaldoProductos();
      this.api.inventario().subscribe({
        next: (p) => {
          this.productos = p;
          this.recalcularTipsSurtir();
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
  }

  cargarPedidos(): void {
    this.api.pedidos().subscribe({
      next: (p) => {
        this.pedidos = p;
        this.recalcularTipsSurtir();
      },
      error: () => {
        this.pedidos = [];
        this.recalcularTipsSurtir();
      },
    });
  }

  /** Tips de surtido guiados por stock (no por calendario: hay productos lentos). */
  recalcularTipsSurtir(): void {
    this.tipsSurtir = [
      this.construirTipSurtir('LIMPIEZA', 'Limpieza / productos'),
      this.construirTipSurtir('JARCERIA', 'Jarcería'),
    ];
  }

  private construirTipSurtir(depto: GrupoPedido, titulo: string): TipSurtir {
    const hoy = this.hoyLocal();
    const fechas = this.fechasSurtirDepto(depto);
    const ultimoIso = fechas.length ? fechas[fechas.length - 1] : null;
    const diasDesde = ultimoIso ? this.diasEntre(ultimoIso, hoy) : null;
    const stock = this.resumenStockDepto(depto);
    const criticos = stock.enCero + stock.bajos;

    let estado: TipSurtirEstado;
    if (stock.total === 0) {
      estado = 'sin_dato';
    } else if (stock.enCero >= 3 || criticos >= 8) {
      estado = 'urgente';
    } else if (stock.enCero >= 1 || stock.bajos >= 2) {
      estado = 'pronto';
    } else {
      estado = 'ok';
    }

    const stockTxt =
      stock.total === 0
        ? 'Sin productos en inventario'
        : stock.enCero === 0 && stock.bajos === 0
          ? `Stock bien · ${stock.total} producto(s)`
          : [
              stock.enCero > 0 ? `${stock.enCero} en cero` : null,
              stock.bajos > 0 ? `${stock.bajos} bajos` : null,
            ]
              .filter(Boolean)
              .join(' · ');

    let recomendadoTexto: string;
    let recomendadoIso: string | null = null;
    if (estado === 'urgente') {
      recomendadoIso = hoy;
      recomendadoTexto = 'Surtir ahora · prioriza los que van en cero';
    } else if (estado === 'pronto') {
      recomendadoIso = hoy;
      recomendadoTexto = 'Conviene surtir pronto · reponer bajos y ceros';
    } else if (estado === 'ok') {
      recomendadoTexto = 'No urge · el stock aguanta';
    } else {
      recomendadoTexto = 'Carga inventario para ver la guía';
    }

    const partesDetalle: string[] = [];
    if (estado === 'urgente' || estado === 'pronto') {
      partesDetalle.push('Levanta pedido: salen todos los ceros (quítalos con × si no aplican) y se mira ~6 meses de ventas.');
    } else if (estado === 'ok') {
      partesDetalle.push('Algunos productos salen lento: mira el stock, no el calendario.');
    }

    return {
      depto,
      titulo,
      ultimoIso,
      ultimoTexto: stockTxt,
      diasDesde,
      cicloDias: null,
      recomendadoIso,
      recomendadoTexto,
      estado,
      detalle: partesDetalle.join(' ') || 'Revisa el stock al decidir el pedido.',
    };
  }

  private resumenStockDepto(depto: GrupoPedido): {
    total: number;
    enCero: number;
    bajos: number;
  } {
    let total = 0;
    let enCero = 0;
    let bajos = 0;
    for (const p of this.productos) {
      if (inferirDepartamento(p.vendePor, p.nombre, p.departamento) !== depto) continue;
      total++;
      const stock = Number(p.stockActual) || 0;
      if (stock <= 0) {
        enCero++;
        continue;
      }
      const umbral = p.vendePor === 'PIEZA' ? 1 : 2;
      if (stock <= umbral) bajos++;
    }
    return { total, enCero, bajos };
  }

  private textoUltimo(iso: string, diasDesde: number): string {
    if (diasDesde === 0) return `Hoy (${this.formatoCorto(iso)})`;
    if (diasDesde === 1) return `Ayer (${this.formatoCorto(iso)})`;
    return `Hace ${diasDesde} días · ${this.formatoCorto(iso)}`;
  }

  private formatoCorto(iso: string): string {
    const [y, m, d] = iso.split('-');
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mi = Number(m) - 1;
    return `${Number(d)}-${meses[mi] || m}-${y}`;
  }

  private fechasSurtirDepto(depto: GrupoPedido): string[] {
    const set = new Set<string>();
    for (const p of this.pedidos) {
      if (!p.fecha || !this.pedidoTieneDepto(p, depto)) continue;
      set.add(p.fecha);
    }
    return [...set].sort();
  }

  private pedidoTieneDepto(p: PedidoRegistrado, depto: GrupoPedido): boolean {
    const items = p.items || [];
    if (!items.length) return false;
    return items.some((it) => {
      const prod = this.productos.find((x) => x.id === it.productoId);
      return (
        inferirDepartamento(it.vendePor, it.productoNombre, prod?.departamento) === depto
      );
    });
  }

  private diasEntre(desdeIso: string, hastaIso: string): number {
    const [y1, m1, d1] = desdeIso.split('-').map(Number);
    const [y2, m2, d2] = hastaIso.split('-').map(Number);
    const a = Date.UTC(y1, m1 - 1, d1);
    const b = Date.UTC(y2, m2 - 1, d2);
    return Math.round((b - a) / 86400000);
  }

  etiquetaEstadoTip(estado: TipSurtirEstado): string {
    if (estado === 'urgente') return 'Surtir ya';
    if (estado === 'pronto') return 'Pronto';
    if (estado === 'ok') return 'Stock ok';
    return 'Sin datos';
  }

  cargarSaldoProductos(): void {
    this.api.apartados().subscribe({
      next: (r) => {
        const t = r.totales || {};
        this.saldoProductos = Number(t['PRODUCTOS'] ?? t['productos'] ?? 0) || 0;
      },
      error: () => (this.saldoProductos = 0),
    });
  }

  get pedidosAbiertos(): PedidoRegistrado[] {
    return this.pedidos.filter((p) => p.estado !== 'CERRADO' || this.saldoDe(p) > 0.009);
  }

  get pedidosCerrados(): PedidoRegistrado[] {
    return this.pedidos.filter((p) => p.estado === 'CERRADO' && this.saldoDe(p) <= 0.009).slice(0, 5);
  }

  saldoDe(p: PedidoRegistrado): number {
    return Number(p.saldoProveedor) || 0;
  }

  get deudaTotal(): number {
    return this.pedidos.reduce((s, p) => s + this.saldoDe(p), 0);
  }

  get proximoPago(): string | null {
    const fechas = this.pedidos
      .filter((p) => this.saldoDe(p) > 0.009 && p.fechaLimitePago)
      .map((p) => p.fechaLimitePago as string)
      .sort();
    return fechas[0] || null;
  }

  hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private iso(y: number, m0: number, day: number): string {
    const mm = String(m0 + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  sumarDias(iso: string, dias: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    return this.iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }

  diasEnMes(y: number, m0: number): number {
    return new Date(y, m0 + 1, 0).getDate();
  }

  onModoPeriodo(): void {
    this.aplicarModoPeriodo();
  }

  /** Vacía Limpieza / Jarcería hasta el próximo Levantar. */
  private vaciarSugerido(): void {
    this.lineas = [];
    this.ultimo = null;
    this.syncPag(true);
  }

  textoVacioGrupo(grupo: 'limpieza' | 'jarceria'): string {
    if (this.cargando) return 'Calculando…';
    const hayManual = this.lineas.some((l) => l.incluido && Number(l.pedir) > 0);
    if (!this.ultimo && !hayManual) return 'Pulsa «Levantar pedido» o agrega un producto a mano.';
    return grupo === 'limpieza' ? 'Nada que pedir de limpieza.' : 'Nada que pedir de jarcería.';
  }

  private aplicarModoPeriodo(): void {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m0 = hoy.getMonth();
    const hoyIso = this.hoyLocal();

    if (this.modoPeriodo === '4_semanas') {
      this.hasta = hoyIso;
      this.desde = this.sumarDias(hoyIso, -27);
      this.diasCobertura = 28;
    } else if (this.modoPeriodo === 'mes_pasado') {
      const prev = new Date(y, m0 - 1, 1);
      const py = prev.getFullYear();
      const pm = prev.getMonth();
      const dias = this.diasEnMes(py, pm);
      this.desde = this.iso(py, pm, 1);
      this.hasta = this.iso(py, pm, dias);
      this.diasCobertura = dias;
    } else if (this.modoPeriodo === 'mes_actual') {
      const dias = this.diasEnMes(y, m0);
      this.desde = this.iso(y, m0, 1);
      this.hasta = hoyIso;
      this.diasCobertura = dias;
    } else if (this.modoPeriodo === 'custom') {
      if (!this.desde || !this.hasta) {
        this.hasta = hoyIso;
        this.desde = this.sumarDias(hoyIso, -29);
      }
      this.diasCobertura = null;
    }
  }

  calcular(): void {
    this.error = '';
    this.ok = '';
    this.cargando = true;
    // Ventana larga de ventas (6 meses) para no omitir productos lentos;
    // cobertura ~1 mes de stock. Los ceros sin ventas también salen (mín. 1).
    const hoyIso = this.hoyLocal();
    this.hasta = hoyIso;
    this.desde = this.sumarDias(hoyIso, -179);
    this.diasCobertura = 28;
    this.modoPeriodo = 'custom';
    const pct = this.ajustarColchon(this.porcentajeExtra);
    this.porcentajeExtra = pct;
    this.api
      .pedidoSugerido({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        diasCobertura: this.diasCobertura,
        porcentajeExtra: pct,
      })
      .subscribe({
        next: (res) => {
          this.ultimo = res;
          this.desde = res.desde;
          this.hasta = res.hasta;
          this.diasCobertura = res.diasCobertura;
          this.porcentajeExtra = this.ajustarColchon(Number(res.porcentajeExtra));
          this.lineas = res.lineas.map((l) => {
            const pedir = this.pedirDesdeColchon(l);
            return {
              ...l,
              sugerido: pedir,
              pedir,
              incluido: true,
            };
          });
          this.syncPag(true);
          this.cargando = false;
          this.ok =
            'Pedido listo: incluye productos en cero (quítalos con × si no los quieres) y ventas de ~6 meses.';
        },
        error: (e) => {
          this.error = e.error?.error || 'No se pudo calcular el pedido';
          this.cargando = false;
        },
      });
  }

  /**
   * Pedir inicial = Con colchón redondeado a entero cerrado (14.4→14, 4.8→5).
   * Siempre número entero al arrancar.
   */
  pedirDesdeColchon(l: Pick<PedidoLinea, 'consumoConColchon' | 'vendePor'>): number {
    return this.redondearPedirCerrado(Number(l.consumoConColchon) || 0);
  }

  /** Siempre entero ≥ 1 si hay cantidad (Math.round). */
  private redondearPedirCerrado(necesidad: number): number {
    if (!Number.isFinite(necesidad) || necesidad <= 0) return 0;
    const n = Math.round(necesidad);
    return n > 0 ? n : 1;
  }

  /** Al editar a mano: encaja en enteros (pieza) o múltiplos de 0.25 (litros). */
  private normalizarPedir(n: number, vendePor?: string): number {
    if (!Number.isFinite(n) || n < 0) return 0;
    if (vendePor === 'PIEZA') return Math.max(0, Math.round(n));
    return Math.max(0, Math.round(n * 4) / 4);
  }

  get proyectaMes(): boolean {
    return !!this.ultimo && this.ultimo.diasObservados !== this.ultimo.diasCobertura;
  }

  private deptoDe(l: PedidoLinea): GrupoPedido {
    return inferirDepartamento(l.vendePor, l.productoNombre, l.departamento);
  }

  private activas(grupo?: GrupoPedido): LineaEditable[] {
    return this.lineas
      .filter((l) => {
        if (!l.incluido || !(Number(l.pedir) > 0)) return false;
        if (!grupo) return true;
        return this.deptoDe(l) === grupo;
      })
      .sort((a, b) =>
        (a.productoNombre || '').localeCompare(b.productoNombre || '', 'es', { sensitivity: 'base' })
      );
  }

  private syncPag(reset = false): void {
    this.pagLitros.setItems(this.activas('LIMPIEZA'), reset);
    this.pagPiezas.setItems(this.activas('JARCERIA'), reset);
  }

  onPedirChange(l: LineaEditable): void {
    l.pedir = this.normalizarPedir(Number(l.pedir), l.vendePor);
    this.syncPag();
  }

  /** Colchón del pedido: solo Sin / 10 / 20 / 30 / 40 / 50. */
  setColchon(pct: number): void {
    this.porcentajeExtra = this.ajustarColchon(pct);
  }

  esColchon(pct: number): boolean {
    return this.porcentajeExtra === pct;
  }

  ajustarPedir(l: LineaEditable, delta: number): void {
    const actual = Number(l.pedir);
    const base = Number.isFinite(actual) ? actual : 0;
    const paso = l.vendePor === 'PIEZA' ? delta : delta * 0.25;
    l.pedir = this.normalizarPedir(base + paso, l.vendePor);
    this.syncPag();
  }

  ajustarAltaCantidad(delta: number): void {
    const actual = Number(this.altaCantidad);
    const base = Number.isFinite(actual) ? actual : 0;
    this.altaCantidad = Math.max(0, Math.ceil(base + delta));
  }

  private ajustarColchon(pct: number): number {
    const n = Number(pct);
    if (!Number.isFinite(n) || n <= 0) return 0;
    let mejor: number = this.colchones[0];
    let dist = Math.abs(n - mejor);
    for (const c of this.colchones) {
      const d = Math.abs(n - c);
      if (d < dist) {
        mejor = c;
        dist = d;
      }
    }
    return mejor;
  }

  quitar(l: LineaEditable): void {
    l.incluido = false;
    l.pedir = 0;
    this.syncPag();
  }

  productoPorId(id: number | null | undefined): InventarioItem | undefined {
    if (id == null) return undefined;
    return this.productos.find((x) => x.id === id);
  }

  agregarManual(): void {
    this.error = '';
    const p = this.productoPorId(this.altaProductoId);
    const cant = Math.ceil(Number(this.altaCantidad) || 0);
    if (!p) {
      this.error = 'Elige un producto del inventario';
      return;
    }
    if (cant <= 0) {
      this.error = 'Indica cuánto pedir';
      return;
    }
    const depto = inferirDepartamento(p.vendePor, p.nombre, p.departamento);
    const ya = this.lineas.find((l) => l.productoId === p.id);
    if (ya) {
      ya.incluido = true;
      ya.pedir = Math.ceil(Number(ya.pedir) || 0) + cant;
      ya.extra = true;
      ya.departamento = depto;
      ya.vendePor = p.vendePor;
      ya.vendePorLabel = p.vendePorLabel;
      ya.productoNombre = p.nombre;
    } else {
      this.lineas = [
        ...this.lineas,
        {
          productoId: p.id,
          productoNombre: p.nombre,
          vendePor: p.vendePor,
          vendePorLabel: p.vendePorLabel,
          stockActual: Number(p.stockActual) || 0,
          consumoObservado: 0,
          consumoBase: 0,
          consumoConColchon: 0,
          faltanteAnterior: 0,
          sugerido: cant,
          departamento: depto,
          pedir: cant,
          incluido: true,
          extra: true,
        },
      ];
    }
    this.altaProductoId = null;
    this.altaCantidad = null;
    // Mostrar la lista del departamento del producto agregado.
    if (this.filtroDepto === 'limpieza' && depto === 'JARCERIA') this.filtroDepto = 'jarceria';
    else if (this.filtroDepto === 'jarceria' && depto === 'LIMPIEZA') this.filtroDepto = 'limpieza';
    this.syncPag(true);
    const donde = depto === 'JARCERIA' ? 'Jarcería' : 'Limpieza';
    this.ok = `Agregado en ${donde}: ${p.nombre}`;
  }

  setFiltroDepto(v: FiltroDepto): void {
    this.filtroDepto = v;
  }

  get mostrarLimpieza(): boolean {
    return this.filtroDepto !== 'jarceria';
  }

  get mostrarJarceria(): boolean {
    return this.filtroDepto !== 'limpieza';
  }

  private lineasARegistrar(): LineaEditable[] {
    if (this.filtroDepto === 'limpieza') return this.activas('LIMPIEZA');
    if (this.filtroDepto === 'jarceria') return this.activas('JARCERIA');
    return this.activas();
  }

  get totalLineas(): number {
    return this.lineasARegistrar().length;
  }

  get etiquetaRegistrar(): string {
    if (this.registrando) return 'Registrando…';
    if (this.filtroDepto === 'limpieza') return 'Registrar pedido de limpieza';
    if (this.filtroDepto === 'jarceria') return 'Registrar pedido de jarcería';
    return 'Registrar pedido';
  }

  get totalLitros(): number {
    return this.activas('LIMPIEZA').length;
  }

  get totalPiezas(): number {
    return this.activas('JARCERIA').length;
  }

  async registrarPedido(): Promise<void> {
    const items = this.lineasARegistrar().map((l) => ({
      productoId: l.productoId,
      cantidad: Number(l.pedir),
    }));
    if (!items.length) {
      this.error = 'No hay productos para registrar';
      return;
    }
    const ok = await this.confirmDlg.ask(
      `¿Registrar pedido con ${items.length} producto(s)? Quedará abierto para registrar lo recibido en Surtir.`,
      { confirmarTexto: 'Registrar' }
    );
    if (!ok) return;
    this.registrando = true;
    this.error = '';
    this.ok = '';
    this.api
      .crearPedido({
        fecha: this.hoyLocal(),
        periodoDesde: this.desde,
        periodoHasta: this.hasta,
        diasCobertura: this.diasCobertura,
        porcentajeExtra: this.porcentajeExtra,
        items,
      })
      .subscribe({
        next: () => {
          this.registrando = false;
          this.ok = 'Pedido registrado. Abre el pedido y captura cuánto llegó.';
          this.vaciarSugerido();
          this.cargarPedidos();
        },
        error: (e) => {
          this.registrando = false;
          this.error = e.error?.error || 'No se pudo registrar el pedido';
        },
      });
  }

  togglePedido(id: number): void {
    if (this.pedidoExpandidoId === id) {
      this.pedidoExpandidoId = null;
      this.recibosEdit = [];
      this.editandoPedidaId = null;
      return;
    }
    this.pedidoExpandidoId = id;
    this.armarDetalle(this.pedidos.find((x) => x.id === id));
  }

  private armarDetalle(p: PedidoRegistrado | undefined): void {
    this.fechaLimitePago = p?.fechaLimitePago || '';
    this.pagadoAhora = null;
    this.altaPedidoProductoId = null;
    this.altaPedidoCantidad = null;
    this.abonoNuevo = { fecha: this.hoyLocal(), monto: null, nota: '' };
    this.editandoAbonoId = null;
    this.editandoPedidaId = null;
    this.recibosEdit = (p?.items || []).map((i) => {
      const recibida = Number(i.cantidadRecibida);
      const pedida = Number(i.cantidadPedida);
      const compra =
        i.precioCompra != null && Number.isFinite(Number(i.precioCompra))
          ? Number(i.precioCompra)
          : null;
      const cantParaTotal = recibida > 0 ? recibida : 1;
      const prod = this.productoPorId(i.productoId);
      return {
        itemId: i.id,
        productoId: i.productoId,
        productoNombre: i.productoNombre,
        pedida,
        pedidaInicial: pedida,
        recibidaInicial: recibida,
        recibida,
        precioCompra: compra,
        totalPagado: compra != null ? Math.round(compra * cantParaTotal * 100) / 100 : null,
        unidad: i.vendePor === 'PIEZA' ? 'pza' : 'L',
        departamento: inferirDepartamento(
          i.vendePor || prod?.vendePor,
          i.productoNombre,
          prod?.departamento
        ),
      };
    });
  }

  get recibosLimpieza(): ReciboEdit[] {
    return this.recibosEdit.filter((r) => r.departamento === 'LIMPIEZA');
  }

  get recibosJarceria(): ReciboEdit[] {
    return this.recibosEdit.filter((r) => r.departamento === 'JARCERIA');
  }

  get recibosPorDepto(): { titulo: string; items: ReciboEdit[] }[] {
    return [
      { titulo: 'Limpieza', items: this.recibosLimpieza },
      { titulo: 'Jarcería', items: this.recibosJarceria },
    ].filter((g) => g.items.length > 0);
  }

  marcarTodoRecibido(): void {
    for (const r of this.recibosEdit) {
      const pedida = Number(r.pedida) || 0;
      r.recibida = pedida;
      if (r.precioCompra != null && pedida > 0) {
        r.totalPagado = Math.round(r.precioCompra * pedida * 100) / 100;
      }
    }
  }

  /** Unitario = total pagado ÷ cantidad recibida. */
  unitarioRecibo(r: ReciboEdit): number | null {
    const rec = Number(r.recibida);
    const total = Number(r.totalPagado);
    if (!Number.isFinite(rec) || rec <= 0) return null;
    if (r.totalPagado == null || String(r.totalPagado).trim() === '') return null;
    if (!Number.isFinite(total) || total < 0) return null;
    return Math.round((total / rec) * 100) / 100;
  }

  guardarRecepcion(): void {
    if (this.pedidoExpandidoId == null) return;
    for (const r of this.recibosEdit) {
      const rec = Math.max(0, Number(r.recibida) || 0);
      if (rec <= 0) continue;
      const u = this.unitarioRecibo(r);
      if (u == null || u < 0) {
        this.error = `Indica el importe del proveedor para «${r.productoNombre}».`;
        return;
      }
    }
    const lineas = this.recibosEdit.map((r) => {
      const u = this.unitarioRecibo(r);
      return {
        itemId: r.itemId,
        cantidadRecibida: Math.max(0, Number(r.recibida) || 0),
        precioProveedor: u,
      };
    });
    this.guardandoRecepcion = true;
    this.error = '';
    this.api
      .registrarRecepcionPedido(this.pedidoExpandidoId, { lineas })
      .subscribe({
        next: (act) => {
          this.guardandoRecepcion = false;
          this.ok = 'Mercancía guardada. Ahora revisa el pago abajo.';
          this.reemplazarPedido(act, true);
          this.cargarPedidos();
          this.cargarSaldoProductos();
          this.vaciarSugerido();
        },
        error: (e) => {
          this.guardandoRecepcion = false;
          this.error = e.error?.error || 'No se pudo guardar el surtido';
        },
      });
  }

  faltaDe(r: ReciboEdit): number {
    return Math.max(0, (Number(r.pedida) || 0) - (Number(r.recibida) || 0));
  }

  empezarEditarPedida(r: ReciboEdit): void {
    this.editandoPedidaId = r.itemId;
    r.pedida = r.pedidaInicial;
    this.error = '';
    setTimeout(() => this.focusPedidaInput(r.itemId));
  }

  cancelarEditarPedida(): void {
    if (this.editandoPedidaId == null) return;
    const r = this.recibosEdit.find((x) => x.itemId === this.editandoPedidaId);
    if (r) r.pedida = r.pedidaInicial;
    this.editandoPedidaId = null;
  }

  onPedidaKey(ev: KeyboardEvent, r: ReciboEdit): void {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.guardarPedida(r);
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.cancelarEditarPedida();
    }
  }

  /** Enter en cantidad/importe: pasa al siguiente campo editable visible. */
  focusSiguienteCampo(ev: Event): void {
    const ke = ev as KeyboardEvent;
    ke.preventDefault();
    const actual = ke.target as HTMLElement;
    const root = actual.closest('.pedido-detalle') || document;
    const campos = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        'input:not([disabled]):not([type=hidden]):not([readonly])'
      )
    ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
    const i = campos.indexOf(actual as HTMLInputElement);
    if (i >= 0 && i < campos.length - 1) {
      campos[i + 1].focus();
      campos[i + 1].select?.();
    }
  }

  private focusPedidaInput(itemId: number): void {
    const nodes = document.querySelectorAll<HTMLInputElement>(
      `input[name="ped${itemId}"], input[name="pedM${itemId}"]`
    );
    for (const el of Array.from(nodes)) {
      if (el.offsetParent !== null || el.getClientRects().length > 0) {
        el.focus();
        el.select();
        return;
      }
    }
    nodes[0]?.focus();
    nodes[0]?.select();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeGlobal(ev: KeyboardEvent): void {
    if (this.editandoPedidaId != null) {
      ev.preventDefault();
      this.cancelarEditarPedida();
      return;
    }
    if (this.editandoAbonoId != null) {
      ev.preventDefault();
      this.cancelarEditarAbono();
    }
  }

  guardarPedida(r: ReciboEdit): void {
    const p = this.pedidoExpandido();
    if (!p || p.estado === 'CERRADO' || this.guardandoPedidaId != null) return;
    const cant = Math.ceil(Number(r.pedida) || 0);
    if (cant <= 0) {
      this.error = 'Lo pedido debe ser mayor a 0 (o quita el producto con ×)';
      r.pedida = r.pedidaInicial;
      return;
    }
    if (cant === r.pedidaInicial) {
      r.pedida = cant;
      this.editandoPedidaId = null;
      return;
    }
    const minRec = Number(r.recibidaInicial) || 0;
    if (cant < minRec) {
      this.error = `No puedes pedir menos de lo ya recibido (${minRec})`;
      r.pedida = r.pedidaInicial;
      return;
    }
    this.guardandoPedidaId = r.itemId;
    this.error = '';
    this.api.actualizarItemPedido(p.id, r.itemId, r.productoId, cant).subscribe({
      next: (act) => {
        this.guardandoPedidaId = null;
        this.editandoPedidaId = null;
        const item = act.items?.find((i) => i.id === r.itemId);
        const nueva = item ? Number(item.cantidadPedida) : cant;
        r.pedida = nueva;
        r.pedidaInicial = nueva;
        this.ok = `Corregido: ${r.productoNombre} → ${nueva}`;
        this.reemplazarPedido(act, false);
      },
      error: (e) => {
        this.guardandoPedidaId = null;
        r.pedida = r.pedidaInicial;
        this.error = e.error?.error || 'No se pudo corregir lo pedido';
      },
    });
  }

  async cerrarPedido(p: PedidoRegistrado): Promise<void> {
    const ok = await this.confirmDlg.ask(`¿Cerrar pedido #${p.id} del ${p.fecha}?`, {
      confirmarTexto: 'Cerrar',
    });
    if (!ok) return;
    this.api.cerrarPedido(p.id).subscribe({
      next: () => {
        this.ok = 'Pedido cerrado';
        this.cargarPedidos();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cerrar'),
    });
  }

  async cancelarPedido(p: PedidoRegistrado): Promise<void> {
    const ok = await this.confirmDlg.ask(
      `¿Cancelar pedido #${p.id}?\nNo se registra mercancía ni stock. Se borra el pedido.`,
      { confirmarTexto: 'Cancelar pedido' }
    );
    if (!ok) return;
    this.api.cancelarPedido(p.id).subscribe({
      next: () => {
        this.ok = 'Pedido cancelado';
        this.pedidoExpandidoId = null;
        this.recibosEdit = [];
        this.cargarPedidos();
        this.cargarSaldoProductos();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cancelar'),
    });
  }

  async eliminarPedido(p: PedidoRegistrado): Promise<void> {
    if (!this.puedeEliminarPedido(p)) {
      this.error =
        'Todavía hay saldo en este pedido. Sáldalo primero; si lo borras pierdes el control de lo que debes.';
      return;
    }
    const ok = await this.confirmDlg.ask(
      `¿Eliminar pedido #${p.id}?\nLas entradas y el stock se quedan; solo se borra el pedido.`,
      { confirmarTexto: 'Eliminar' }
    );
    if (!ok) return;
    this.api.eliminarPedido(p.id).subscribe({
      next: () => {
        this.ok = 'Pedido eliminado (el stock se queda)';
        this.pedidoExpandidoId = null;
        this.recibosEdit = [];
        this.cargarPedidos();
        this.cargarSaldoProductos();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo eliminar'),
    });
  }

  /** Con mercancía: solo si ya no debes nada (el pedido ya no guarda deuda). */
  puedeEliminarPedido(p: PedidoRegistrado): boolean {
    if (!this.tieneEntradas(p)) return false;
    return this.saldoDe(p) <= 0.009;
  }

  tieneEntradas(p: PedidoRegistrado): boolean {
    if (p.tieneEntradas === true) return true;
    if (this.num(p.totalProveedor) > 0.009) return true;
    return (p.items || []).some((i) => this.num(i.cantidadRecibida) > 0);
  }

  /** Para plantillas (Number() no existe en el template de Angular). */
  num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  mostrarPago(p: PedidoRegistrado): boolean {
    return this.tieneEntradas(p) || this.saldoDe(p) > 0.009 || this.num(p.totalProveedor) > 0.009;
  }

  etiquetaEstado(estado: string): string {
    if (estado === 'PARCIAL') return 'Parcial';
    if (estado === 'CERRADO') return 'Cerrado';
    return 'Abierto';
  }

  pedidoExpandido(): PedidoRegistrado | undefined {
    if (this.pedidoExpandidoId == null) return undefined;
    return this.pedidos.find((x) => x.id === this.pedidoExpandidoId);
  }

  totalNuevoSurtido(): number {
    let s = 0;
    for (const r of this.recibosEdit) {
      const rec = Math.max(0, Number(r.recibida) || 0);
      const delta = rec - (Number(r.recibidaInicial) || 0);
      if (delta <= 0) continue;
      const u = this.unitarioRecibo(r);
      if (u == null) continue;
      s += u * delta;
    }
    return Math.round(s * 100) / 100;
  }

  pagadoAhoraEfectivo(): number {
    if (this.pagadoAhora == null || String(this.pagadoAhora).trim() === '') {
      return this.totalNuevoSurtido();
    }
    return Math.max(0, Number(this.pagadoAhora) || 0);
  }

  quedaDebiendo(): number {
    const p = this.pedidoExpandido();
    const ya = Number(p?.totalProveedor) || 0;
    const pagado = Number(p?.totalPagado) || 0;
    const nuevo = this.totalNuevoSurtido();
    const ahora = this.pagadoAhoraEfectivo();
    return Math.max(0, Math.round((ya + nuevo - pagado - ahora) * 100) / 100);
  }

  usarPagoCompleto(): void {
    this.pagadoAhora = this.totalNuevoSurtido();
  }

  usarFiado(): void {
    this.pagadoAhora = 0;
  }

  guardarFechaLimite(p: PedidoRegistrado): void {
    this.api.actualizarCreditoPedido(p.id, this.fechaLimitePago || null).subscribe({
      next: (act) => {
        this.reemplazarPedido(act);
        this.ok = this.fechaLimitePago ? 'Fecha de pago guardada' : 'Sin fecha límite';
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo guardar la fecha'),
    });
  }

  alcanzaPagoAhora(): boolean {
    const pago = this.pagadoAhoraEfectivo();
    if (pago <= 0.009) return true;
    return pago <= this.saldoProductos + 0.009;
  }

  alcanzaAbonoNuevo(): boolean {
    const monto = Number(this.abonoNuevo.monto) || 0;
    if (monto <= 0) return true;
    return monto <= this.saldoProductos + 0.009;
  }

  agregarItemAPedido(): void {
    const p = this.pedidoExpandido();
    if (!p || p.estado === 'CERRADO') return;
    const prod = this.productoPorId(this.altaPedidoProductoId);
    const cant = Math.ceil(Number(this.altaPedidoCantidad) || 0);
    if (!prod) {
      this.error = 'Elige un producto';
      return;
    }
    if (cant <= 0) {
      this.error = 'Indica la cantidad';
      return;
    }
    this.error = '';
    this.api.agregarItemPedido(p.id, prod.id, cant).subscribe({
        next: (act) => {
          this.altaPedidoProductoId = null;
          this.altaPedidoCantidad = null;
          const depto = inferirDepartamento(prod.vendePor, prod.nombre, prod.departamento);
          const donde = depto === 'JARCERIA' ? 'Jarcería' : 'Limpieza';
          this.ok = `Agregado en ${donde}: ${prod.nombre}`;
          this.reemplazarPedido(act, true);
        },
      error: (e) => (this.error = e.error?.error || 'No se pudo agregar'),
    });
  }

  async quitarItemPedido(r: ReciboEdit): Promise<void> {
    const p = this.pedidoExpandido();
    if (!p) return;
    if ((Number(r.recibidaInicial) || 0) > 0) {
      this.error = 'Ya hay mercancía recibida; no se puede quitar.';
      return;
    }
    const ok = await this.confirmDlg.ask(`¿Quitar «${r.productoNombre}» de este pedido?`, {
      confirmarTexto: 'Quitar',
    });
    if (!ok) return;
    this.api.eliminarItemPedido(p.id, r.itemId).subscribe({
      next: (act) => {
        this.ok = 'Producto quitado del pedido';
        this.reemplazarPedido(act, true);
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo quitar'),
    });
  }

  registrarAbono(): void {
    const p = this.pedidoExpandido();
    if (!p) return;
    const monto = Number(this.abonoNuevo.monto);
    if (!this.abonoNuevo.fecha || !Number.isFinite(monto) || monto <= 0) {
      this.error = 'Indica fecha y cuánto pagas';
      return;
    }
    if (monto > this.saldoProductos + 0.009) {
      this.error = `En Productos solo hay $${this.saldoProductos.toFixed(2)}. Baja el abono o aparta más.`;
      return;
    }
    this.guardandoAbono = true;
    this.error = '';
    this.api
      .crearAbonoPedido(p.id, {
        fecha: this.abonoNuevo.fecha,
        monto,
        nota: this.abonoNuevo.nota || null,
        fechaLimitePago: this.fechaLimitePago || null,
      })
      .subscribe({
        next: (act) => {
          this.guardandoAbono = false;
          this.abonoNuevo = { fecha: this.hoyLocal(), monto: null, nota: '' };
          this.ok = 'Pago al proveedor registrado (gasto en Productos)';
          this.reemplazarPedido(act, true);
          this.cargarSaldoProductos();
        },
        error: (e) => {
          this.guardandoAbono = false;
          this.error = e.error?.error || 'No se pudo registrar el pago';
        },
      });
  }

  pagarTodoLoQueFalta(p: PedidoRegistrado): void {
    this.abonoNuevo.fecha = this.abonoNuevo.fecha || this.hoyLocal();
    this.abonoNuevo.monto = Math.round(this.saldoDe(p) * 100) / 100;
  }

  empezarEditarAbono(a: PedidoAbono): void {
    this.editandoAbonoId = a.id;
    this.editAbono = { fecha: a.fecha, monto: Number(a.monto), nota: a.nota || '' };
  }

  onAbonoEditKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.cancelarEditarAbono();
    }
  }

  cancelarEditarAbono(): void {
    this.editandoAbonoId = null;
  }

  guardarAbonoEditado(): void {
    if (this.editandoAbonoId == null) return;
    const monto = Number(this.editAbono.monto);
    if (!this.editAbono.fecha || !Number.isFinite(monto) || monto <= 0) {
      this.error = 'Indica fecha y monto';
      return;
    }
    const actual = this.pedidoExpandido()?.abonos?.find((x) => x.id === this.editandoAbonoId);
    const anterior = Number(actual?.monto) || 0;
    const extra = monto - anterior;
    if (extra > 0.009 && extra > this.saldoProductos + 0.009) {
      this.error = `En Productos solo hay $${this.saldoProductos.toFixed(2)} para subir este pago.`;
      return;
    }
    this.guardandoAbono = true;
    this.api
      .actualizarAbonoPedido(this.editandoAbonoId, {
        fecha: this.editAbono.fecha,
        monto,
        nota: this.editAbono.nota || null,
      })
      .subscribe({
        next: (act) => {
          this.guardandoAbono = false;
          this.editandoAbonoId = null;
          this.ok = 'Pago actualizado (gasto en Productos)';
          this.reemplazarPedido(act);
          this.cargarSaldoProductos();
        },
        error: (e) => {
          this.guardandoAbono = false;
          this.error = e.error?.error || 'No se pudo actualizar el pago';
        },
      });
  }

  async eliminarAbono(a: PedidoAbono): Promise<void> {
    const ok = await this.confirmDlg.ask(`¿Eliminar el pago de $${Number(a.monto).toFixed(2)}?`, {
      confirmarTexto: 'Eliminar',
    });
    if (!ok) return;
    this.api.eliminarAbonoPedido(a.id).subscribe({
      next: (act) => {
        this.ok = 'Pago eliminado (se revirtió el gasto en Productos)';
        this.reemplazarPedido(act);
        this.cargarSaldoProductos();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo eliminar el pago'),
    });
  }

  private reemplazarPedido(act: PedidoRegistrado, rearmarDetalle = false): void {
    this.pedidos = this.pedidos.map((x) => (x.id === act.id ? act : x));
    if (!this.pedidos.some((x) => x.id === act.id)) {
      this.pedidos = [act, ...this.pedidos];
    }
    if (this.pedidoExpandidoId !== act.id) return;
    this.fechaLimitePago = act.fechaLimitePago || this.fechaLimitePago;
    if (rearmarDetalle) {
      const keepPago = this.pagadoAhora;
      this.armarDetalle(act);
      this.pagadoAhora = keepPago;
    }
  }
}
