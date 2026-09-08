import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, MODOS_VENTA, ModoVenta, TipoVenta, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';

interface LineaVenta {
  key: number;
  /** Captura en UI; Menudeo se resuelve a Litros/Pieza según el producto. */
  modo: ModoVenta;
  productoId: number | null;
  cantidad: number | null;
  precioManual: number | null;
  total: number | null;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.scss',
})
export class VentasComponent implements OnInit {
  ventas: Venta[] = [];
  productos: InventarioItem[] = [];
  modos = MODOS_VENTA;
  error = '';
  ok = '';
  filtro = '';
  guardando = false;
  fecha = this.hoyLocal();
  fechaMin: string | null = null;
  fechaUltimoCorte: string | null = null;
  private fechasCorte = new Set<string>();
  private idMarcadoresCorte = new Set<number>();
  lineas: LineaVenta[] = [];
  private nextKey = 1;

  @ViewChildren(ProductoAutocompleteComponent) prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
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
    this.cargar();
    this.resetLineas(3);
  }

  get filtradas(): Venta[] {
    const q = this.filtro.trim().toLowerCase();
    const sinCasa = this.ventas.filter((v) => v.tipoVenta !== 'CASA');
    const base = !q
      ? sinCasa
      : sinCasa.filter(
          (v) =>
            (v.productoNombre ?? '').toLowerCase().includes(q) ||
            v.tipoVentaLabel.toLowerCase().includes(q)
        );
    return [...base].sort((a, b) => {
      const porFecha = b.fecha.localeCompare(a.fecha);
      return porFecha !== 0 ? porFecha : b.id - a.id;
    });
  }

  productoDe(l: LineaVenta): InventarioItem | undefined {
    return this.productos.find((x) => x.id === l.productoId);
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

  sugerirTotalMayoreo(l: LineaVenta): void {
    if (!this.esMayoreo(l) || this.tienePrecioManual(l)) return;
    if (l.productoId == null || l.cantidad == null) return;
    const unit = this.precioUnitarioMayoreo(l);
    const cant = Number(l.cantidad);
    if (unit > 0 && cant > 0) {
      l.total = Math.round(unit * cant * 100) / 100;
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
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar ventas'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
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
  }

  onProductoEnter(index: number): void {
    setTimeout(() => this.focusCantidad(index), 0);
  }

  onCantidadEnter(ev: Event, index: number): void {
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

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas = [this.nuevaLinea()];
      return;
    }
    this.lineas.splice(index, 1);
  }

  guardarTodas(): void {
    this.error = '';
    this.ok = '';
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

    this.guardando = true;
    const requests = pendientes.map((l) =>
      this.api.crearVenta({
        fecha: this.fecha,
        productoId: l.productoId,
        tipoVenta: this.tipoVentaEfectivo(l),
        cantidad: Number(l.cantidad),
        total: this.totalParaGuardar(l),
      })
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.ok = `Se guardaron ${pendientes.length} venta(s)`;
        this.guardando = false;
        this.resetLineas(3);
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.error = e.error?.error || 'Error al guardar. Revisa las filas e intenta de nuevo.';
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
}
