import { ChangeDetectorRef, Component, HostListener, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { ClearableDirective } from '../../clearable.directive';
import { AutoHideDirective } from '../../auto-hide.directive';
import { elementoVisible, esMovilTactil } from '../../captura-focus.util';
import { FechaDiaComponent } from '../../fecha-dia.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import {
  InventarioItem,
  ModoVenta,
  MODOS_VENTA,
  PedidoDomicilio,
  TipoVenta,
} from '../../modelos';
import { alinearLineasCaptura, capturaEsMovil, capturaLineasVacias, capturaBreakpointCambio, capturaTieneFocoEnCampo } from '../../paginacion.util';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { compartirTicketWhatsApp } from '../../ticket-whatsapp.util';

interface LineaDom {
  key: number;
  modo: ModoVenta;
  productoId: number | null;
  cantidad: number | null;
  precioManual: number | null;
  total: number | null;
  pagoTarjeta: boolean;
}

@Component({
  selector: 'app-domicilio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FechaDiaComponent,
    FechaDmYPipe,
    ClearableDirective,
    AutoHideDirective,
    ProductoAutocompleteComponent,
  ],
  templateUrl: './domicilio.component.html',
  styleUrl: './domicilio.component.scss',
})
export class DomicilioComponent implements OnInit {
  @ViewChildren(ProductoAutocompleteComponent) prodAutos!: QueryList<ProductoAutocompleteComponent>;

  productos: InventarioItem[] = [];
  pendientes: PedidoDomicilio[] = [];
  historial: PedidoDomicilio[] = [];
  /** Clientes que ya tuvieron al menos un pedido a domicilio. */
  clientesConocidos: string[] = [];
  clienteListaAbierta = false;
  clienteIndice = 0;
  error = '';
  ok = '';
  guardando = false;
  compartiendoId: number | null = null;
  editandoId: number | null = null;

  /** Modal de entrega: total + paga con + cambio. */
  entregaPedido: PedidoDomicilio | null = null;
  entregaPagaCon: number | null = null;
  entregaTarjeta = false;
  entregando = false;

  fecha = this.hoyLocal();
  /** Día siguiente al último corte (no se puede pedir antes). */
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  cliente = '';
  nota = '';
  lineas: LineaDom[] = [];
  private nextKey = 1;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private idsPreparables = new Set<number>();
  /** Evita realinear al abrir teclado (resize por altura). */
  private capturaMovil = capturaEsMovil();

  /** Misma captura que Ventas (menudeo, mayoreo, pesos, etc.). */
  readonly modos = MODOS_VENTA;

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resetLineas();
    this.alinearLineasViewport();
    this.cargar();
  }

  @HostListener('window:resize')
  onResizeCaptura(): void {
    if (capturaTieneFocoEnCampo()) return;
    const { cambio, movil } = capturaBreakpointCambio(this.capturaMovil);
    if (!cambio) return;
    this.capturaMovil = movil;
    this.alinearLineasViewport();
  }

  private lineaDomVacia(l: LineaDom): boolean {
    return (
      l.productoId == null &&
      !(Number(l.cantidad) > 0) &&
      !(Number(l.total) > 0) &&
      !(Number(l.precioManual) > 0)
    );
  }

  private alinearLineasViewport(): void {
    this.lineas = alinearLineasCaptura(
      this.lineas,
      (l) => this.lineaDomVacia(l),
      () => this.nuevaLinea()
    );
  }

  hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    // Sí admite futuros (pedidos para otros días); solo bloquea ≤ corte.
    if (this.fechaMin && this.fecha < this.fechaMin) this.fecha = this.fechaMin;
  }

  private validarFechaPedido(): boolean {
    if (!this.fecha) {
      this.error = 'Indica la fecha';
      return false;
    }
    if (this.fechaUltimoCorte && this.fecha <= this.fechaUltimoCorte) {
      this.error = `No se pueden registrar el ${formatFechaDmY(this.fechaUltimoCorte)} ni antes (ya hubo corte). Usa una fecha desde ${formatFechaDmY(this.fechaMin!)}.`;
      return false;
    }
    if (this.fechaMin && this.fecha < this.fechaMin) {
      this.error = `La fecha debe ser desde ${formatFechaDmY(this.fechaMin)} (día siguiente al último corte)`;
      return false;
    }
    return true;
  }

  get clientesFiltrados(): string[] {
    const q = this.cliente.trim().toLocaleLowerCase('es');
    if (!q) return this.clientesConocidos.slice(0, 30);
    return this.clientesConocidos
      .filter((c) => c.toLocaleLowerCase('es').includes(q))
      .slice(0, 30);
  }

  abrirListaClientes(): void {
    this.clienteListaAbierta = this.clientesConocidos.length > 0;
    this.clienteIndice = 0;
  }

  cerrarListaClientes(): void {
    // delay so mousedown on option can run first
    setTimeout(() => {
      this.clienteListaAbierta = false;
    }, 120);
  }

  onClienteCambio(): void {
    this.clienteListaAbierta = this.clientesConocidos.length > 0;
    this.clienteIndice = 0;
  }

  elegirCliente(nombre: string): void {
    this.cliente = nombre;
    this.clienteListaAbierta = false;
  }

  onClienteKeydown(ev: KeyboardEvent): void {
    const list = this.clientesFiltrados;
    if (ev.key === 'ArrowDown' && list.length) {
      ev.preventDefault();
      this.clienteListaAbierta = true;
      this.clienteIndice = Math.min(this.clienteIndice + 1, list.length - 1);
      return;
    }
    if (ev.key === 'ArrowUp' && list.length) {
      ev.preventDefault();
      this.clienteIndice = Math.max(this.clienteIndice - 1, 0);
      return;
    }
    if (ev.key === 'Enter' && this.clienteListaAbierta && list.length) {
      ev.preventDefault();
      this.elegirCliente(list[this.clienteIndice] ?? list[0]);
      return;
    }
    if (ev.key === 'Escape') {
      this.clienteListaAbierta = false;
    }
  }

  cargar(): void {
    forkJoin({
      inv: this.api.inventario(),
      todos: this.api.domicilios(),
      caja: this.api.caja(),
      recetas: this.api.recetas().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ inv, todos, caja, recetas }) => {
        this.productos = inv;
        this.idsPreparables = new Set((recetas || []).map((r) => r.productoResultadoId));
        this.pendientes = todos.filter((p) => p.estado === 'PENDIENTE');
        this.historial = todos.filter((p) => p.estado !== 'PENDIENTE').slice(0, 20);
        const vistos = new Set<string>();
        const nombres: string[] = [];
        for (const p of todos) {
          const n = (p.cliente || '').trim();
          if (!n) continue;
          const key = n.toLocaleLowerCase('es');
          if (vistos.has(key)) continue;
          vistos.add(key);
          nombres.push(n);
        }
        nombres.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        this.clientesConocidos = nombres;
        this.fechaMin = caja.fechaInicio || null;
        this.fechaUltimoCorte =
          caja.fechaUltimoCorte ||
          (caja.fechaInicio ? this.sumarDias(caja.fechaInicio, -1) : null);
        this.asegurarFechaValida();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar'),
    });
  }

  private nuevaLinea(): LineaDom {
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

  resetLineas(n = capturaLineasVacias()): void {
    this.lineas = Array.from({ length: Math.max(1, n) }, () => this.nuevaLinea());
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.cdr.detectChanges();
    this.enfocarCaptura(this.lineas.length - 1, 'producto');
  }

  quitarLinea(i: number): void {
    if (this.lineas.length <= 1) {
      this.lineas[i] = this.nuevaLinea();
      this.alinearLineasViewport();
      return;
    }
    this.lineas.splice(i, 1);
    this.alinearLineasViewport();
  }

  productoDe(l: LineaDom): InventarioItem | undefined {
    return this.productos.find((p) => p.id === l.productoId);
  }

  stockDisponible(productoId: number | null): number | null {
    if (productoId == null) return null;
    const p = this.productos.find((x) => x.id === productoId);
    if (!p) return null;
    return Number(p.stockActual) || 0;
  }

  /** Unidades físicas que pide la línea (en Pesos: $ / menudeo). */
  unidadesPedidas(l: LineaDom): number {
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

  excedeStock(l: LineaDom, index: number): boolean {
    if (l.productoId == null) return false;
    const stock = this.stockDisponible(l.productoId);
    if (stock == null) return false;
    const pedidas = this.unidadesPedidas(l);
    if (pedidas <= 0) return false;
    return pedidas + this.unidadesPedidasOtros(l.productoId, index) > stock + 1e-9;
  }

  get hayExcesoStock(): boolean {
    return this.lineas.some((l, i) => this.excedeStock(l, i) && Number(l.cantidad) > 0);
  }

  avisoStock(l: LineaDom, index: number): string | null {
    if (!this.excedeStock(l, index)) return null;
    const nombre = this.productoDe(l)?.nombre || 'este producto';
    return `No tienes suficiente ${nombre}.`;
  }

  esPreparable(l: LineaDom): boolean {
    return l.productoId != null && this.idsPreparables.has(l.productoId);
  }

  unidadDe(l: LineaDom): string {
    if (l.modo === 'PESOS') return '$';
    const p = this.productoDe(l);
    return p?.vendePor === 'PIEZA' ? 'pza' : 'L';
  }

  tipoVentaEfectivo(l: LineaDom): TipoVenta {
    if (l.modo === 'MENUDEO') {
      return this.productoDe(l)?.vendePor === 'PIEZA' ? 'PIEZA' : 'LITROS';
    }
    return l.modo;
  }

  esMayoreo(l: LineaDom): boolean {
    return l.modo === 'MAYOREO';
  }

  esSinCobro(l: LineaDom): boolean {
    return l.modo === 'MUESTRA' || l.modo === 'CASA';
  }

  permitePrecioManual(l: LineaDom): boolean {
    return l.modo === 'MAYOREO';
  }

  tienePrecioManual(l: LineaDom): boolean {
    return l.precioManual != null && String(l.precioManual) !== '' && Number(l.precioManual) > 0;
  }

  toggleTarjeta(l: LineaDom): void {
    if (this.esSinCobro(l)) {
      l.pagoTarjeta = false;
      return;
    }
    l.pagoTarjeta = !l.pagoTarjeta;
  }

  precioLista(l: LineaDom): number {
    return Number(this.productoDe(l)?.precioVentaHoy) || 0;
  }

  precioUnitarioMayoreo(l: LineaDom): number {
    const p = this.productoDe(l);
    if (!p) return 0;
    const cant = Number(l.cantidad) || 0;
    if (cant >= 10) return Number(p.precioMayoreo10) || Number(p.precioVentaHoy) || 0;
    if (cant >= 5) return Number(p.precioMayoreo5) || Number(p.precioVentaHoy) || 0;
    return Number(p.precioVentaHoy) || 0;
  }

  /** Cobro al cliente: solo enteros o .50 (13.10→13.50, 13.80→14). */
  private pesoCobro(n: number): number {
    const v = Math.round(n * 100) / 100;
    const entero = Math.floor(v + 1e-9);
    const frac = Math.round((v - entero) * 100) / 100;
    if (frac === 0) return entero;
    if (frac <= 0.5) return entero + 0.5;
    return entero + 1;
  }

  totalEstimado(l: LineaDom): number | null {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return null;
    const tipo = this.tipoVentaEfectivo(l);
    if (tipo === 'MUESTRA' || tipo === 'CASA') return 0;
    if (tipo === 'PESOS') return this.pesoCobro(cant);
    if (tipo === 'MAYOREO') {
      if (this.tienePrecioManual(l)) {
        return this.pesoCobro(Number(l.precioManual) * cant);
      }
      if (l.total != null && Number(l.total) > 0) {
        return this.pesoCobro(Number(l.total));
      }
      const u = this.precioUnitarioMayoreo(l);
      return u > 0 ? this.pesoCobro(u * cant) : null;
    }
    const u = this.precioLista(l);
    return u > 0 ? this.pesoCobro(u * cant) : null;
  }

  get totalTicket(): number {
    return this.lineas.reduce((s, l) => s + (this.totalEstimado(l) || 0), 0);
  }

  lineasValidas(): LineaDom[] {
    return this.lineas.filter((l) => l.productoId != null && Number(l.cantidad) > 0);
  }

  setModo(l: LineaDom, modo: ModoVenta): void {
    l.modo = modo;
    if (modo !== 'MAYOREO') {
      l.precioManual = null;
      l.total = null;
    }
    if (this.esSinCobro(l)) {
      l.pagoTarjeta = false;
    }
  }

  onFechaEnter(): void {
    this.enfocarCaptura(0, 'producto');
  }

  onProductoEnter(index: number): void {
    this.avanzarDesde(index, 'producto');
  }

  onCampoEnter(ev: Event, index: number, campo: 'cantidad' | 'precio' | 'total'): void {
    ev.preventDefault();
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
      if (this.focusById('dom-precio-' + l.key)) return;
    }
    if ((desde === 'cantidad' || desde === 'precio') && this.esMayoreo(l) && !this.tienePrecioManual(l)) {
      if (this.focusById('dom-total-' + l.key)) return;
    }
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      return;
    }
    this.enfocarCaptura(irA, 'producto');
  }

  private autosCaptura(): ProductoAutocompleteComponent[] {
    return (this.prodAutos?.toArray() || []).filter((a) => !!a.inputName?.startsWith('domProd'));
  }

  private enfocarCaptura(index: number, campo: 'producto' | 'cantidad'): void {
    const go = () => {
      if (campo === 'cantidad') {
        if (!this.focusById('dom-cant-' + (this.lineas[index]?.key ?? ''))) {
          this.autosCaptura()[index]?.focus();
        }
      } else {
        this.autosCaptura()[index]?.focus();
      }
      const l = this.lineas[index];
      // nearest + auto: smooth scroll pelea con el teclado virtual en móvil
      if (l) {
        document.getElementById('dom-linea-' + l.key)?.scrollIntoView({
          block: 'nearest',
          behavior: 'auto',
        });
      }
    };
    if (this.focusTimer != null) clearTimeout(this.focusTimer);
    this.cdr.detectChanges();
    this.focusTimer = setTimeout(go, 50);
  }

  private focusById(id: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el || !elementoVisible(el)) return false;
    el.focus({ preventScroll: true });
    // select() en móvil a veces cierra/reabre el teclado
    if (!esMovilTactil()) el.select();
    return true;
  }

  private bodyDesdeForm() {
    const lineas = this.lineasValidas().map((l) => ({
      productoId: l.productoId,
      tipoVenta: this.tipoVentaEfectivo(l),
      cantidad: Number(l.cantidad),
      total: this.totalEstimado(l),
      pagoTarjeta: !!l.pagoTarjeta && !this.esSinCobro(l),
    }));
    return {
      fecha: this.fecha,
      cliente: this.cliente.trim() || null,
      telefono: null as string | null,
      nota: this.nota.trim() || null,
      lineas,
    };
  }

  guardar(): void {
    this.error = '';
    this.ok = '';
    const lineas = this.lineasValidas();
    if (!this.validarFechaPedido()) return;
    if (lineas.length === 0) {
      this.error = 'Agrega al menos un producto';
      return;
    }
    if (this.hayExcesoStock) {
      this.error =
        'Hay cantidades mayores al stock. Revisa Inventario, Surtir o Preparar.';
      return;
    }
    for (const l of lineas) {
      if (l.modo === 'MAYOREO' && (this.totalEstimado(l) == null || this.totalEstimado(l)! <= 0)) {
        this.error = 'En mayoreo indica precio o total';
        return;
      }
    }
    this.guardando = true;
    const body = this.bodyDesdeForm();
    const req$ =
      this.editandoId != null
        ? this.api.actualizarDomicilio(this.editandoId, body)
        : this.api.crearDomicilio(body);
    req$.subscribe({
      next: (p) => {
        const esNuevo = this.editandoId == null;
        this.guardando = false;
        this.ok = esNuevo
          ? 'Pedido guardado como pendiente'
          : p.estado === 'ENTREGADA'
            ? 'Domicilio entregado actualizado (ventas recalculadas)'
            : 'Pedido actualizado';
        this.editandoId = null;
        this.cliente = '';
        this.nota = '';
        this.fecha = this.hoyLocal();
        this.resetLineas();
        this.cargar();
        this.cdr.detectChanges();
        this.enfocarCaptura(0, 'producto');
        // Solo al crear: una imagen para WhatsApp. En ediciones no vuelve a mandar.
        if (esNuevo) {
          void this.compartirPedido(p);
        }
      },
      error: (e) => {
        this.guardando = false;
        this.error = e.error?.error || 'No se pudo guardar';
      },
    });
  }

  editar(p: PedidoDomicilio): void {
    this.error = '';
    this.ok = '';
    this.editandoId = p.id;
    this.fecha = p.fecha;
    this.cliente = p.cliente || '';
    this.nota = p.nota || '';
    this.lineas = p.items.map((it) => {
      const modo: ModoVenta =
        it.tipoVenta === 'MAYOREO'
          ? 'MAYOREO'
          : it.tipoVenta === 'PESOS'
            ? 'PESOS'
            : it.tipoVenta === 'MUESTRA'
              ? 'MUESTRA'
              : it.tipoVenta === 'CASA'
                ? 'CASA'
                : 'MENUDEO';
      const cant = Number(it.cantidad);
      const tot = Number(it.total);
      const unit = cant > 0 ? Math.round((tot / cant) * 100) / 100 : null;
      return {
        key: this.nextKey++,
        modo,
        productoId: it.productoId,
        cantidad: cant,
        precioManual: modo === 'MAYOREO' ? unit : null,
        total: modo === 'MAYOREO' ? tot : null,
        pagoTarjeta: !!it.pagoTarjeta,
      };
    });
    if (!this.lineas.length) this.resetLineas();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.detectChanges();
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.cliente = '';
    this.nota = '';
    this.fecha = this.hoyLocal();
    this.resetLineas();
  }

  async compartirPedido(p: PedidoDomicilio): Promise<void> {
    this.compartiendoId = p.id;
    this.error = '';
    try {
      const modo = await compartirTicketWhatsApp({
        cliente: p.cliente,
        telefonoCliente: p.telefono,
        fechaIso: p.fecha,
        fecha: formatFechaDmY(p.fecha),
        total: Number(p.total) || 0,
        nota: p.nota,
        lineas: (p.items || []).map((it) => ({
          nombre: it.productoNombre || 'Producto',
          detalle: `${Number(it.cantidad)} · ${it.tipoVentaLabel}`,
          total: Number(it.total) || 0,
        })),
      });
      this.ok =
        modo === 'compartido'
          ? 'Elige el chat en Compartir y listo'
          : 'Imagen descargada: ábrela y compártela en WhatsApp';
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudo generar la imagen';
    } finally {
      this.compartiendoId = null;
      this.cdr.detectChanges();
    }
  }

  abrirEntrega(p: PedidoDomicilio): void {
    this.error = '';
    this.entregaPedido = p;
    this.entregaPagaCon = null;
    const todoTarjeta =
      (p.items || []).length > 0 && (p.items || []).every((it) => !!it.pagoTarjeta);
    this.entregaTarjeta = todoTarjeta;
    if (todoTarjeta) {
      this.entregaPagaCon = Number(p.total) || 0;
    }
  }

  cerrarEntrega(): void {
    this.entregaPedido = null;
    this.entregaPagaCon = null;
    this.entregaTarjeta = false;
    this.entregando = false;
  }

  get entregaTotal(): number {
    return Number(this.entregaPedido?.total) || 0;
  }

  get entregaCambio(): number | null {
    if (this.entregaTarjeta) return 0;
    const paga = Number(this.entregaPagaCon);
    if (!Number.isFinite(paga) || paga <= 0) return null;
    return Math.round((paga - this.entregaTotal) * 100) / 100;
  }

  get puedeConfirmarEntrega(): boolean {
    if (!this.entregaPedido) return false;
    if (this.entregaTarjeta) return true;
    const paga = Number(this.entregaPagaCon);
    return Number.isFinite(paga) && paga + 0.001 >= this.entregaTotal;
  }

  setEntregaTarjeta(v: boolean): void {
    this.entregaTarjeta = v;
    if (v) {
      this.entregaPagaCon = this.entregaTotal;
    } else {
      this.entregaPagaCon = null;
    }
  }

  confirmarEntrega(): void {
    if (!this.entregaPedido || !this.puedeConfirmarEntrega) return;
    const p = this.entregaPedido;
    this.entregando = true;
    this.api
      .entregarDomicilio(p.id, { fecha: this.hoyLocal(), pagoTarjeta: this.entregaTarjeta })
      .subscribe({
      next: () => {
        this.entregando = false;
        this.cerrarEntrega();
        if (this.editandoId === p.id) this.cancelarEdicion();
        this.cargar();
      },
      error: (e) => {
        this.entregando = false;
        this.error = e.error?.error || 'No se pudo entregar';
      },
    });
  }

  async cancelar(p: PedidoDomicilio): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Cancelar este pedido pendiente?', {
      confirmarTexto: 'Cancelar pedido',
    });
    if (!ok) return;
    this.api.cancelarDomicilio(p.id).subscribe({
      next: () => {
        this.ok = 'Pedido cancelado';
        if (this.editandoId === p.id) this.cancelarEdicion();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cancelar'),
    });
  }

  async eliminar(p: PedidoDomicilio): Promise<void> {
    const entregado = p.estado === 'ENTREGADA';
    const ok = await this.confirmDlg.ask(
      entregado
        ? `¿Eliminar el domicilio #${p.id} entregado? También se borran las ventas ligadas.`
        : '¿Eliminar este pedido?',
      { confirmarTexto: 'Eliminar' }
    );
    if (!ok) return;
    this.api.eliminarDomicilio(p.id).subscribe({
      next: () => {
        this.ok = entregado ? 'Domicilio y ventas eliminados' : 'Pedido eliminado';
        if (this.editandoId === p.id) this.cancelarEdicion();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo eliminar'),
    });
  }
}
