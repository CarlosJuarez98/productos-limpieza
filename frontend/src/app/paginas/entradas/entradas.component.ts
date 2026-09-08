import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { Entrada, InventarioItem, Produccion } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
  precioProveedor: number | null;
}

type CambioPrecio = 'SUBIO' | 'BAJO' | 'IGUAL' | null;

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './entradas.component.html',
  styleUrl: './entradas.component.scss',
})
export class EntradasComponent implements OnInit {
  @ViewChildren('prodLote') prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('precioInput') precioInputs!: QueryList<ElementRef<HTMLInputElement>>;

  entradas: Entrada[] = [];
  producciones: Produccion[] = [];
  productos: InventarioItem[] = [];
  error = '';
  errorPrep = '';
  okPrep = '';
  guardando = false;
  private nextKey = 1;
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  lineas: LineaForm[] = [this.nuevaLinea(), this.nuevaLinea(), this.nuevaLinea()];
  prep = {
    fecha: this.hoyLocal(),
    productoResultadoId: null as number | null,
    cantidadResultado: null as number | null,
    productoInsumoId: null as number | null,
    cantidadInsumo: null as number | null,
    insumoNombre: '' as string,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();
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
  }

  private validarFecha(fecha: string, destino: 'error' | 'errorPrep' = 'error'): boolean {
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
    return { key: this.nextKey++, productoId: null, cantidad: null, precioProveedor: null };
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

  onProductoChange(l: LineaForm, id: number | null): void {
    l.productoId = id;
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
    return this.productos.filter((p) => {
      const n = p.nombre.toLowerCase();
      return n === 'cloro' || n.startsWith('fabuloso ');
    });
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
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

  /** Enter en precio → producto de la siguiente fila (crea fila si hace falta). */
  onPrecioEnter(ev: Event, index: number): void {
    ev.preventDefault();
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      this.cdr.detectChanges();
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
      next: (e) => (this.entradas = e),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar entradas'),
    });
    this.api.producciones().subscribe({
      next: (p) => (this.producciones = p),
      error: () => (this.producciones = []),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
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
    this.asegurarFechaValida();
    if (!this.validarFecha(this.fecha)) return;
    const lineas = this.lineas
      .filter((l) => l.productoId != null && Number(l.cantidad) > 0)
      .map((l) => ({
        productoId: l.productoId as number,
        cantidad: Number(l.cantidad),
        precioProveedor:
          l.precioProveedor != null && String(l.precioProveedor) !== ''
            ? Number(l.precioProveedor)
            : null,
      }));
    if (!lineas.length) {
      this.error = 'Agrega al menos un producto con cantidad';
      return;
    }
    this.guardando = true;
    this.api
      .crearEntradasLote({
        fecha: this.fecha,
        lineas,
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          this.lineas = [this.nuevaLinea(), this.nuevaLinea(), this.nuevaLinea()];
          this.cargar();
        },
        error: (e) => {
          this.guardando = false;
          this.error = e.error?.error || 'Error al guardar entradas';
        },
      });
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
    const insumoNombre = this.prep.insumoNombre;
    this.api
      .crearProduccion({
        fecha: this.prep.fecha,
        productoResultadoId: this.prep.productoResultadoId,
        cantidadResultado: cantRes,
        productoInsumoId: this.prep.productoInsumoId,
        cantidadInsumo: cantIns,
      })
      .subscribe({
        next: () => {
          this.okPrep = `Listo: +${cantRes} y se descontó ${cantIns} de ${insumoNombre}`;
          this.prep.cantidadResultado = null;
          this.prep.cantidadInsumo = null;
          this.prep.productoResultadoId = null;
          this.prep.productoInsumoId = null;
          this.prep.insumoNombre = '';
          this.cargar();
        },
        error: (e) => (this.errorPrep = e.error?.error || 'Error al registrar preparación'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta entrada?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarEntrada(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }

  async eliminarProduccion(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta preparación?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarProduccion(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.errorPrep = e.error?.error || 'Error al eliminar'),
    });
  }
}
