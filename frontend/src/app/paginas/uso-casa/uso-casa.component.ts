import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api.service';
import { formatFechaDmY } from '../../fecha-dmy.pipe';
import { CajaResumen, InventarioItem, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';

interface LineaUso {
  key: number;
  productoId: number | null;
  cantidad: number | null;
}

interface ProductoPeriodo {
  productoId: number | null;
  nombre: string;
  cantidad: number;
  unidad: 'L' | 'pza';
  importe: number;
  color: string;
}

interface PeriodoOpcion {
  id: string;
  label: string;
  desde: string;
  hasta: string;
}

const COLORES_BARRA = [
  '#1f6b4f',
  '#2563eb',
  '#c2410c',
  '#7c3aed',
  '#0d9488',
  '#b45309',
  '#db2777',
  '#4f46e5',
  '#15803d',
  '#0369a1',
  '#a16207',
  '#be123c',
];

/** Mismo inicio histórico que CajaService (primer periodo sin corte anterior). */
const INICIO_HISTORICO = '2025-10-29';

@Component({
  selector: 'app-uso-casa',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent],
  templateUrl: './uso-casa.component.html',
  styleUrl: './uso-casa.component.scss',
})
export class UsoCasaComponent implements OnInit {
  movimientos: Venta[] = [];
  productos: InventarioItem[] = [];
  caja: CajaResumen | null = null;
  error = '';
  ok = '';
  guardando = false;
  /** 'actual' o yyyy-MM-dd del corte. */
  periodoId = 'actual';
  fecha = this.hoyLocal();
  lineas: LineaUso[] = [];
  private nextKey = 1;

  @ViewChildren(ProductoAutocompleteComponent) prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(
    private api: ApiService,
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

  ngOnInit(): void {
    this.resetLineas(1);
    this.cargar();
  }

  sumarDias(iso: string, dias: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /** Periodo abierto + cada corte cerrado (más reciente primero). */
  get periodos(): PeriodoOpcion[] {
    const opts: PeriodoOpcion[] = [];
    const hoy = this.hoyLocal();
    const fechaInicio = this.caja?.fechaInicio || null;
    const fechaFin = this.caja?.fechaFin || hoy;

    if (fechaInicio) {
      opts.push({
        id: 'actual',
        label: `Periodo actual (${formatFechaDmY(fechaInicio)} → ${formatFechaDmY(fechaFin)})`,
        desde: fechaInicio,
        hasta: fechaFin,
      });
    }

    const cortes = [...(this.caja?.fechasCorte || [])].sort((a, b) => b.localeCompare(a));
    const asc = [...cortes].sort((a, b) => a.localeCompare(b));
    for (const hasta of cortes) {
      const idx = asc.indexOf(hasta);
      const desde = idx > 0 ? this.sumarDias(asc[idx - 1], 1) : INICIO_HISTORICO;
      opts.push({
        id: hasta,
        label: `Corte ${formatFechaDmY(hasta)} (${formatFechaDmY(desde)} → ${formatFechaDmY(hasta)})`,
        desde,
        hasta,
      });
    }

    if (!opts.length) {
      opts.push({
        id: 'actual',
        label: `Periodo actual (hasta ${formatFechaDmY(hoy)})`,
        desde: INICIO_HISTORICO,
        hasta: hoy,
      });
    }
    return opts;
  }

  get periodoActivo(): PeriodoOpcion {
    return this.periodos.find((p) => p.id === this.periodoId) || this.periodos[0];
  }

  get labelPeriodo(): string {
    const p = this.periodoActivo;
    if (!p) return '';
    if (p.id === 'actual') {
      return `${formatFechaDmY(p.desde)} → ${formatFechaDmY(p.hasta)}`;
    }
    return `corte ${formatFechaDmY(p.hasta)}`;
  }

  get movimientosDelPeriodo(): Venta[] {
    const p = this.periodoActivo;
    if (!p) return [];
    return this.movimientos.filter((m) => m.fecha >= p.desde && m.fecha <= p.hasta);
  }

  get totalImporte(): number {
    return Math.round(this.movimientosDelPeriodo.reduce((s, m) => s + this.importeDe(m), 0) * 100) / 100;
  }

  get lineasConDatos(): number {
    return this.lineas.filter((l) => this.tieneDatos(l)).length;
  }

  /** Productos del periodo: barras por litros o piezas. */
  get productosDelPeriodo(): ProductoPeriodo[] {
    const map = new Map<string, ProductoPeriodo>();
    for (const m of this.movimientosDelPeriodo) {
      const key = String(m.productoId ?? m.productoNombre ?? '—');
      let row = map.get(key);
      if (!row) {
        row = {
          productoId: m.productoId,
          nombre: m.productoNombre || '—',
          cantidad: 0,
          unidad: this.unidadDe(m.productoId),
          importe: 0,
          color: this.colorDe(m.productoId, m.productoNombre || '—'),
        };
        map.set(key, row);
      }
      row.cantidad += Number(m.cantidad) || 0;
      row.importe += this.importeDe(m);
    }
    const usados = new Set<string>();
    return [...map.values()]
      .map((r) => ({
        ...r,
        cantidad: Math.round(r.cantidad * 100) / 100,
        importe: Math.round(r.importe * 100) / 100,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((r, i) => {
        let color = this.colorDe(r.productoId, r.nombre);
        if (usados.has(color)) {
          color = COLORES_BARRA[i % COLORES_BARRA.length];
          let j = 0;
          while (usados.has(color) && j < COLORES_BARRA.length) {
            color = COLORES_BARRA[(i + j) % COLORES_BARRA.length];
            j++;
          }
        }
        usados.add(color);
        return { ...r, color };
      });
  }

  get maxCantidad(): number {
    const max = Math.max(0, ...this.productosDelPeriodo.map((p) => p.cantidad));
    return max > 0 ? max : 1;
  }

  alturaBarra(cantidad: number): number {
    return Math.max(4, Math.round((cantidad / this.maxCantidad) * 100));
  }

  unidadDe(productoId: number | null | undefined): 'L' | 'pza' {
    const p = this.productos.find((x) => x.id === productoId);
    return p?.vendePor === 'PIEZA' ? 'pza' : 'L';
  }

  colorDe(productoId: number | null | undefined, nombre: string): string {
    const seed = productoId != null ? productoId * 2654435761 : this.hashTexto(nombre);
    const idx = Math.abs(seed) % COLORES_BARRA.length;
    return COLORES_BARRA[idx];
  }

  private hashTexto(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  importeDe(m: Venta): number {
    const p = this.productos.find((x) => x.id === m.productoId);
    const unit = Number(p?.precioVentaHoy) || 0;
    return Math.round(Number(m.cantidad) * unit * 100) / 100;
  }

  seleccionarPeriodoDeFecha(fecha: string): void {
    const hit = this.periodos.find((p) => fecha >= p.desde && fecha <= p.hasta);
    this.periodoId = hit?.id || 'actual';
  }

  cargar(): void {
    this.api.usoCasa().subscribe({
      next: (v) => (this.movimientos = v),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar uso en casa'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
    this.api.caja().subscribe({
      next: (c) => {
        this.caja = c;
        if (!this.periodos.some((p) => p.id === this.periodoId)) {
          this.periodoId = 'actual';
        }
      },
      error: () => {
        /* sin caja: solo periodo genérico */
      },
    });
  }

  private nuevaLinea(): LineaUso {
    return { key: this.nextKey++, productoId: null, cantidad: null };
  }

  private resetLineas(n: number): void {
    this.lineas = Array.from({ length: n }, () => this.nuevaLinea());
  }

  private tieneDatos(l: LineaUso): boolean {
    return l.productoId != null || (Number(l.cantidad) > 0);
  }

  private lineaCompleta(l: LineaUso): boolean {
    const cant = Number(l.cantidad);
    return l.productoId != null && Number.isFinite(cant) && cant > 0;
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.cdr.detectChanges();
    setTimeout(() => this.focusProducto(this.lineas.length - 1), 0);
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas = [this.nuevaLinea()];
      return;
    }
    this.lineas.splice(index, 1);
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

  guardar(): void {
    this.error = '';
    this.ok = '';
    if (!this.fecha) {
      this.error = 'Indica la fecha';
      return;
    }
    if (this.fecha > this.hoyLocal()) {
      this.error = 'No se pueden registrar fechas futuras';
      return;
    }

    const incompletas = this.lineas.filter((l) => this.tieneDatos(l) && !this.lineaCompleta(l));
    if (incompletas.length) {
      this.error = 'Completa producto y cantidad en cada fila';
      return;
    }

    const pendientes = this.lineas.filter((l) => this.lineaCompleta(l));
    if (!pendientes.length) {
      this.error = 'Agrega al menos un producto';
      return;
    }

    const fechaGuardada = this.fecha;
    this.guardando = true;
    const requests = pendientes.map((l) =>
      this.api.crearVenta({
        fecha: this.fecha,
        productoId: l.productoId!,
        tipoVenta: 'CASA',
        cantidad: Number(l.cantidad),
      })
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.guardando = false;
        this.resetLineas(1);
        this.ok = pendientes.length === 1 ? 'Uso registrado' : `${pendientes.length} usos registrados`;
        this.api.usoCasa().subscribe({
          next: (v) => {
            this.movimientos = v;
            this.seleccionarPeriodoDeFecha(fechaGuardada);
          },
        });
        this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
        setTimeout(() => this.focusProducto(0), 50);
      },
      error: (e) => {
        this.guardando = false;
        this.error = e.error?.error || 'Error al guardar. Revisa las filas e intenta de nuevo.';
        this.cargar();
      },
    });
  }
}
