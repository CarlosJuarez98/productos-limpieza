import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { switchMap, Subscription } from 'rxjs';
import { of } from 'rxjs';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { Entrada, InventarioItem, Produccion } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import { PullRefreshService } from '../../pull-refresh.service';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { AutoHideDirective } from '../../auto-hide.directive';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
  precioProveedor: number | null;
  /** Cantidad a traspasar de esta línea (opcional, ≤ cantidad de entrada). */
  cantidadTraspaso: number | null;
}

type CambioPrecio = 'SUBIO' | 'BAJO' | 'IGUAL' | null;

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductoAutocompleteComponent,
    FechaDmYPipe,
    ClearableDirective,
    PaginadorComponent,
    AutoHideDirective,
  ],
  templateUrl: './entradas.component.html',
  styleUrl: './entradas.component.scss',
})
export class EntradasComponent implements OnInit, OnDestroy {
  @ViewChildren('prodLote') prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('precioInput') precioInputs!: QueryList<ElementRef<HTMLInputElement>>;

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
  guardando = false;
  guardandoEdit = false;
  /** Traspasar parte del lote a una persona en el mismo guardado. */
  tambienTraspasar = false;
  traspasoPersona = '';
  /** Móvil: paneles secundarios colapsados por defecto. */
  prepAbierta = typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches;
  histAbierta = typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches;
  private nextKey = 1;
  private pullSub?: Subscription;
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  lineas: LineaForm[] = [this.nuevaLinea()];
  prep = {
    fecha: this.hoyLocal(),
    productoResultadoId: null as number | null,
    cantidadResultado: null as number | null,
    productoInsumoId: null as number | null,
    cantidadInsumo: null as number | null,
    insumoNombre: '' as string,
  };
  editandoPrepId: number | null = null;
  editandoEntradaId: number | null = null;
  formEdit = {
    fecha: this.hoyLocal(),
    productoId: null as number | null,
    cantidad: null as number | null,
    precioProveedor: null as number | null,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private pullRefresh: PullRefreshService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
  }

  togglePrep(): void {
    this.prepAbierta = !this.prepAbierta;
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

  private nuevaLinea(): LineaForm {
    return {
      key: this.nextKey++,
      productoId: null,
      cantidad: null,
      precioProveedor: null,
      cantidadTraspaso: null,
    };
  }

  onProductoChange(l: LineaForm, id: number | null): void {
    l.productoId = id;
  }

  nombreProducto(productoId: number | null): string {
    if (productoId == null) return '—';
    return this.productos.find((p) => p.id === productoId)?.nombre || '—';
  }

  toggleTambienTraspasar(): void {
    this.tambienTraspasar = !this.tambienTraspasar;
    if (!this.tambienTraspasar) {
      this.traspasoPersona = '';
      for (const l of this.lineas) l.cantidadTraspaso = null;
    }
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

  totalLinea(l: LineaForm): number | null {
    const cant = Number(l.cantidad);
    const precio = Number(l.precioProveedor);
    if (!Number.isFinite(cant) || cant <= 0 || !Number.isFinite(precio) || precio < 0) return null;
    return Math.round(cant * precio * 100) / 100;
  }

  get totalLote(): number {
    return Math.round(
      this.lineas.reduce((s, l) => s + (this.totalLinea(l) ?? 0), 0) * 100
    ) / 100;
  }

  get productosPreparables(): InventarioItem[] {
    return this.productos.filter((p) => this.esProductoPreparacion(p.nombre));
  }

  /** Entradas de proveedor: sin Cloro ni Fabuloso (salen de preparación). */
  get productosParaEntrada(): InventarioItem[] {
    return this.productos.filter((p) => !this.esProductoPreparacion(p.nombre));
  }

  private esProductoPreparacion(nombre: string | null | undefined): boolean {
    const n = (nombre || '').trim().toLowerCase();
    return n === 'cloro' || n === 'fabuloso' || n.startsWith('fabuloso ');
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.cdr.detectChanges();
    setTimeout(() => this.focusProducto(this.lineas.length - 1), 0);
  }

  /** Enter en producto → cantidad. */
  onProductoEnter(index: number): void {
    setTimeout(() => this.focusCantidad(index), 0);
  }

  /** Enter en cantidad → precio proveedor. */
  onCantidadEnter(ev: Event, index: number): void {
    ev.preventDefault();
    setTimeout(() => this.focusPrecio(index), 0);
  }

  /** Enter en precio → siguiente fila (crea una si hace falta), como en ventas. */
  onPrecioEnter(ev: Event, index: number): void {
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

  private focusPrecio(index: number): void {
    const el = this.precioInputs?.get(index)?.nativeElement;
    if (!el) return;
    el.focus();
    el.select();
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas = [this.nuevaLinea()];
      return;
    }
    this.lineas.splice(index, 1);
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
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
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

  onResultadoChange(id: number | null): void {
    this.prep.productoResultadoId = id;
    this.prep.productoInsumoId = null;
    this.prep.insumoNombre = '';
    this.errorPrep = '';
    if (id == null) return;
    this.api.recetaProduccion(id).subscribe({
      next: (r) => {
        if (r.encontrada && r.productoInsumoId != null) {
          this.prep.productoInsumoId = r.productoInsumoId;
          this.prep.insumoNombre = r.productoInsumoNombre ?? '';
        } else {
          this.errorPrep = 'No hay receta para ese producto (Cloro←Hipoclorito o Fabuloso←Base)';
        }
      },
    });
  }

  guardar(): void {
    this.error = '';
    this.ok = '';
    this.asegurarFechaValida();
    if (!this.validarFecha(this.fecha)) return;

    const lineasForm = this.lineas.filter((l) => l.productoId != null && Number(l.cantidad) > 0);
    const lineas = lineasForm.map((l) => ({
      productoId: l.productoId as number,
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
      .find((p) => p && this.esProductoPreparacion(p.nombre));
    if (prohibido) {
      this.error =
        `«${prohibido.nombre}» se obtiene por preparación (Hipoclorito / Base Fabuloso), no por entrada de proveedor`;
      return;
    }

    let lineasTraspaso: { productoId: number; cantidad: number }[] = [];
    if (this.tambienTraspasar) {
      if (!this.traspasoPersona.trim()) {
        this.error = 'Selecciona una persona de la lista';
        return;
      }
      for (const l of lineasForm) {
        const cantEnt = Number(l.cantidad);
        const cantTr = Number(l.cantidadTraspaso);
        if (!Number.isFinite(cantTr) || cantTr <= 0) continue;
        if (cantTr > cantEnt) {
          this.error = `En «${this.nombreProducto(l.productoId)}» no puedes traspasar más de lo que entra (${cantEnt})`;
          return;
        }
        lineasTraspaso.push({ productoId: l.productoId as number, cantidad: cantTr });
      }
      if (!lineasTraspaso.length) {
        this.error = 'Indica cuánto traspasar en al menos un producto (ej. 5 de 10)';
        return;
      }
    }

    const persona = this.traspasoPersona.trim();
    const fechaGuardada = this.fecha;
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
          this.lineas = [this.nuevaLinea()];
          this.tambienTraspasar = false;
          this.traspasoPersona = '';
          this.cargar();
        },
        error: (e) => {
          this.guardando = false;
          this.error =
            e.error?.error ||
            (lineasTraspaso.length
              ? 'La entrada se pudo guardar, pero falló el traspaso. Revísalo en Traspasos.'
              : 'Error al guardar entradas');
          this.cargar();
        },
      });
  }

  editarEntrada(e: Entrada): void {
    this.errorEdit = '';
    this.editandoEntradaId = e.id;
    this.formEdit = {
      fecha: e.fecha,
      productoId: e.productoId,
      cantidad: e.cantidad,
      precioProveedor: e.precioProveedor,
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
    if (prod && this.esProductoPreparacion(prod.nombre)) {
      this.errorEdit =
        `«${prod.nombre}» se obtiene por preparación, no por entrada de proveedor`;
      return;
    }
    this.guardandoEdit = true;
    this.api
      .actualizarEntrada(this.editandoEntradaId, {
        fecha: this.formEdit.fecha,
        productoId: this.formEdit.productoId,
        cantidad: cant,
        precioProveedor:
          this.formEdit.precioProveedor != null && String(this.formEdit.precioProveedor) !== ''
            ? Number(this.formEdit.precioProveedor)
            : null,
        actualizarPrecioCompra: true,
        aplicarAPedido: null,
        pedidoId: null,
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          this.cancelarEdicionEntrada();
          this.cargar();
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
    this.prep = {
      fecha: p.fecha,
      productoResultadoId: p.productoResultadoId,
      cantidadResultado: p.cantidadResultado,
      productoInsumoId: p.productoInsumoId,
      cantidadInsumo: p.cantidadInsumo,
      insumoNombre: p.productoInsumoNombre || '',
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
    };
    this.asegurarFechaValida();
  }

  guardarPreparacion(): void {
    this.errorPrep = '';
    this.okPrep = '';
    this.asegurarFechaValida();
    if (!this.validarFecha(this.prep.fecha, 'errorPrep')) return;
    const cantRes = Number(this.prep.cantidadResultado);
    const cantIns = Number(this.prep.cantidadInsumo);
    if (
      this.prep.productoResultadoId == null ||
      this.prep.productoInsumoId == null ||
      !Number.isFinite(cantRes) ||
      !Number.isFinite(cantIns) ||
      cantRes <= 0 ||
      cantIns <= 0
    ) {
      this.errorPrep = 'Completa producto, insumo y cantidades';
      return;
    }
    const body = {
      fecha: this.prep.fecha,
      productoResultadoId: this.prep.productoResultadoId,
      cantidadResultado: cantRes,
      productoInsumoId: this.prep.productoInsumoId,
      cantidadInsumo: cantIns,
    };
    const insumoNombre = this.prep.insumoNombre;
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
            : `Listo: +${cantRes} y se descontó ${cantIns} de ${insumoNombre}`;
        this.cancelarEdicionPrep();
        this.okPrep = msg;
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
}
