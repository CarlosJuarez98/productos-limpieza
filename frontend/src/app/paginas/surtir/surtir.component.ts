import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { PedidoLinea, PedidoRegistrado, PedidoSugerido } from '../../modelos';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { PullRefreshService } from '../../pull-refresh.service';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { AutoHideDirective } from '../../auto-hide.directive';

type LineaEditable = PedidoLinea & { pedir: number | null; incluido: boolean };
type ModoPeriodo = 'mes_pasado' | 'mes_actual' | '30' | 'caja' | 'custom';
type GrupoPedido = 'LITROS' | 'PIEZA';
type ReciboEdit = {
  itemId: number;
  productoNombre: string;
  pedida: number;
  recibida: number | null;
  /** Total que cobró el proveedor por lo recibido (unitario = total ÷ recibido). */
  totalPagado: number | null;
  /** Precio compra de catálogo (para sugerir total). */
  precioCompra: number | null;
  unidad: string;
};

@Component({
  selector: 'app-surtir',
  standalone: true,
  imports: [CommonModule, FormsModule, ClearableDirective, PaginadorComponent, FechaDmYPipe, AutoHideDirective],
  templateUrl: './surtir.component.html',
  styleUrl: './surtir.component.scss',
})
export class SurtirComponent implements OnInit, OnDestroy {
  error = '';
  ok = '';
  cargando = false;
  registrando = false;
  porcentajeExtra: number | null = 20;
  modoPeriodo: ModoPeriodo = 'mes_pasado';
  desde = '';
  hasta = '';
  diasCobertura: number | null = null;
  fechaInicioCaja: string | null = null;
  lineas: LineaEditable[] = [];
  ultimo: PedidoSugerido | null = null;
  pedidos: PedidoRegistrado[] = [];
  pedidoExpandidoId: number | null = null;
  /** Edición de cantidades recibidas del pedido expandido. */
  recibosEdit: ReciboEdit[] = [];
  guardandoRecepcion = false;
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
    this.api.caja().subscribe({
      next: (c) => {
        this.fechaInicioCaja = c.fechaInicio;
      },
    });
    this.cargarPedidos();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => {
      this.cargarPedidos();
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

  get pedidosAbiertos(): PedidoRegistrado[] {
    return this.pedidos.filter((p) => p.estado !== 'CERRADO');
  }

  get pedidosCerrados(): PedidoRegistrado[] {
    return this.pedidos.filter((p) => p.estado === 'CERRADO').slice(0, 5);
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
    if (!this.ultimo) return 'Pulsa «Levantar pedido» para ver qué pedir.';
    return grupo === 'limpieza' ? 'Nada que pedir de limpieza.' : 'Nada que pedir de jarcería.';
  }

  private aplicarModoPeriodo(): void {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m0 = hoy.getMonth();
    const hoyIso = this.hoyLocal();

    if (this.modoPeriodo === 'mes_pasado') {
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
    } else if (this.modoPeriodo === '30') {
      this.hasta = hoyIso;
      this.desde = this.sumarDias(hoyIso, -29);
      this.diasCobertura = 30;
    } else if (this.modoPeriodo === 'caja' && this.fechaInicioCaja) {
      this.desde = this.fechaInicioCaja;
      this.hasta = hoyIso;
      const [ay, am, ad] = this.desde.split('-').map(Number);
      const [by, bm, bd] = this.hasta.split('-').map(Number);
      const a = new Date(ay, am - 1, ad);
      const b = new Date(by, bm - 1, bd);
      const dias = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
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
    const pct = Number(this.porcentajeExtra);
    const cob =
      this.diasCobertura != null && Number.isFinite(Number(this.diasCobertura))
        ? Number(this.diasCobertura)
        : undefined;
    this.api
      .pedidoSugerido({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        diasCobertura: cob,
        porcentajeExtra: Number.isFinite(pct) ? pct : 20,
      })
      .subscribe({
        next: (res) => {
          this.ultimo = res;
          this.desde = res.desde;
          this.hasta = res.hasta;
          this.diasCobertura = res.diasCobertura;
          this.porcentajeExtra = Number(res.porcentajeExtra);
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

  private activas(grupo?: GrupoPedido): LineaEditable[] {
    return this.lineas.filter((l) => {
      if (!l.incluido || !(Number(l.pedir) > 0)) return false;
      if (!grupo) return true;
      if (grupo === 'PIEZA') return l.vendePor === 'PIEZA';
      return l.vendePor !== 'PIEZA';
    });
  }

  private syncPag(reset = false): void {
    this.pagLitros.setItems(this.activas('LITROS'), reset);
    this.pagPiezas.setItems(this.activas('PIEZA'), reset);
  }

  onPedirChange(l: LineaEditable): void {
    let n = Number(l.pedir);
    if (!Number.isFinite(n) || n < 0) n = 0;
    // Siempre enteros: se compra por litros o piezas cerrados.
    l.pedir = Math.ceil(n);
    this.syncPag();
  }

  quitar(l: LineaEditable): void {
    l.incluido = false;
    l.pedir = 0;
    this.syncPag();
  }

  get totalLineas(): number {
    return this.activas().length;
  }

  get totalLitros(): number {
    return this.activas('LITROS').length;
  }

  get totalPiezas(): number {
    return this.activas('PIEZA').length;
  }

  async registrarPedido(): Promise<void> {
    const items = this.activas().map((l) => ({
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
    const p = this.pedidos.find((x) => x.id === id);
    this.recibosEdit = (p?.items || []).map((i) => {
      const recibida = Number(i.cantidadRecibida);
      const compra =
        i.precioCompra != null && Number.isFinite(Number(i.precioCompra))
          ? Number(i.precioCompra)
          : null;
      const cantParaTotal = recibida > 0 ? recibida : 1;
      return {
        itemId: i.id,
        productoNombre: i.productoNombre,
        pedida: Number(i.cantidadPedida),
        recibida,
        precioCompra: compra,
        totalPagado: compra != null ? Math.round(compra * cantParaTotal * 100) / 100 : null,
        unidad: i.vendePor === 'PIEZA' ? 'pza' : 'L',
      };
    });
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
        this.error = `Indica el total pagado al proveedor para «${r.productoNombre}».`;
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
    this.api.registrarRecepcionPedido(this.pedidoExpandidoId, lineas).subscribe({
      next: () => {
        this.guardandoRecepcion = false;
        this.ok = 'Surtido registrado. Lo que faltó se tomará en el siguiente pedido.';
        this.pedidoExpandidoId = null;
        this.recibosEdit = [];
        this.cargarPedidos();
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

  async eliminarPedido(p: PedidoRegistrado): Promise<void> {
    const ok = await this.confirmDlg.ask(
      `¿Eliminar pedido #${p.id}?\nLas entradas y el stock se quedan; solo se borra el pedido.`,
      { confirmarTexto: 'Eliminar' }
    );
    if (!ok) return;
    this.api.eliminarPedido(p.id).subscribe({
      next: () => {
        this.ok = 'Pedido eliminado';
        this.cargarPedidos();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo eliminar'),
    });
  }

  etiquetaEstado(estado: string): string {
    if (estado === 'PARCIAL') return 'Parcial';
    if (estado === 'CERRADO') return 'Cerrado';
    return 'Abierto';
  }
}
