import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { RangoFechasComponent } from '../../rango-fechas.component';
import { FechaDiaComponent } from '../../fecha-dia.component';

type LineaEditable = PedidoLinea & { pedir: number | null; incluido: boolean; extra?: boolean };
type ModoPeriodo = '4_semanas' | 'mes_pasado' | 'mes_actual' | 'custom';
type GrupoPedido = 'LIMPIEZA' | 'JARCERIA';
type FiltroDepto = 'todo' | 'limpieza' | 'jarceria';
type ReciboEdit = {
  itemId: number;
  productoId: number;
  productoNombre: string;
  pedida: number;
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
  imports: [CommonModule, FormsModule, ClearableDirective, PaginadorComponent, FechaDmYPipe, AutoHideDirective, ProductoAutocompleteComponent, RangoFechasComponent, FechaDiaComponent],
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
    this.api.inventario().subscribe({ next: (p) => (this.productos = p), error: () => (this.productos = []) });
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => {
      this.cargarPedidos();
      this.cargarSaldoProductos();
      this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
    });
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
  }

  cargarPedidos(): void {
    this.api.pedidos().subscribe({
      next: (p) => (this.pedidos = p),
      error: () => (this.pedidos = []),
    });
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
    if (this.modoPeriodo !== 'custom') {
      this.aplicarModoPeriodo();
    }
    const pct = this.ajustarColchon(this.porcentajeExtra);
    this.porcentajeExtra = pct;
    const cob =
      this.diasCobertura != null && Number.isFinite(Number(this.diasCobertura))
        ? Number(this.diasCobertura)
        : undefined;
    this.api
      .pedidoSugerido({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        diasCobertura: cob,
        porcentajeExtra: pct,
      })
      .subscribe({
        next: (res) => {
          this.ultimo = res;
          this.desde = res.desde;
          this.hasta = res.hasta;
          this.diasCobertura = res.diasCobertura;
          this.porcentajeExtra = this.ajustarColchon(Number(res.porcentajeExtra));
          this.lineas = res.lineas.map((l) => ({
            ...l,
            pedir: Math.ceil(Number(l.sugerido) || 0),
            incluido: true,
          }));
          this.syncPag(true);
          this.cargando = false;
        },
        error: (e) => {
          this.error = e.error?.error || 'No se pudo calcular el pedido';
          this.cargando = false;
        },
      });
  }

  get proyectaMes(): boolean {
    return !!this.ultimo && this.ultimo.diasObservados !== this.ultimo.diasCobertura;
  }

  private deptoDe(l: PedidoLinea): GrupoPedido {
    return inferirDepartamento(l.vendePor, l.productoNombre, l.departamento);
  }

  private activas(grupo?: GrupoPedido): LineaEditable[] {
    return this.lineas.filter((l) => {
      if (!l.incluido || !(Number(l.pedir) > 0)) return false;
      if (!grupo) return true;
      return this.deptoDe(l) === grupo;
    });
  }

  private syncPag(reset = false): void {
    this.pagLitros.setItems(this.activas('LIMPIEZA'), reset);
    this.pagPiezas.setItems(this.activas('JARCERIA'), reset);
  }

  onPedirChange(l: LineaEditable): void {
    let n = Number(l.pedir);
    if (!Number.isFinite(n) || n < 0) n = 0;
    // Siempre enteros: se compra por litros o piezas cerrados.
    l.pedir = Math.ceil(n);
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
    l.pedir = Math.max(0, Math.ceil(base + delta));
    this.onPedirChange(l);
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
    this.recibosEdit = (p?.items || []).map((i) => {
      const recibida = Number(i.cantidadRecibida);
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
        pedida: Number(i.cantidadPedida),
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
      r.recibida = r.pedida;
      if (r.precioCompra != null && r.pedida > 0) {
        r.totalPagado = Math.round(r.precioCompra * r.pedida * 100) / 100;
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
    return Math.max(0, r.pedida - (Number(r.recibida) || 0));
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
