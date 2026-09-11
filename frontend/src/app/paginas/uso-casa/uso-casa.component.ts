import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';
import { CajaResumen, InventarioItem, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { PullRefreshService } from '../../pull-refresh.service';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { AutoHideDirective } from '../../auto-hide.directive';

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
  /** Texto corto del botón. */
  chip: string;
  /** Rango de fechas bajo el botón / tooltip. */
  rango: string;
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
  imports: [
    CommonModule,
    FormsModule,
    ProductoAutocompleteComponent,
    FechaDmYPipe,
    ClearableDirective,
    PaginadorComponent,
    AutoHideDirective,
  ],
  templateUrl: './uso-casa.component.html',
  styleUrl: './uso-casa.component.scss',
})
export class UsoCasaComponent implements OnInit, OnDestroy {
  movimientos: Venta[] = [];
  movimientosDelPeriodo: Venta[] = [];
  pagHist = new PaginacionEstado<Venta>();
  productos: InventarioItem[] = [];
  caja: CajaResumen | null = null;
  error = '';
  errorEdit = '';
  ok = '';
  guardandoEdit = false;
  /** 'actual' o yyyy-MM-dd del corte. */
  periodoId = 'actual';
  mostrarCortes = false;
  chartAbierto = true;
  editandoId: number | null = null;
  formEdit = {
    fecha: this.hoyLocal(),
    productoId: null as number | null,
    cantidad: null as number | null,
  };
  private pullSub?: Subscription;

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private pullRefresh: PullRefreshService
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
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
  }

  toggleChart(): void {
    this.chartAbierto = !this.chartAbierto;
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
        chip: 'Actual',
        rango: `${formatFechaDmY(fechaInicio)} → ${formatFechaDmY(fechaFin)}`,
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
        chip: formatFechaDmY(hasta),
        rango: `${formatFechaDmY(desde)} → ${formatFechaDmY(hasta)}`,
        desde,
        hasta,
      });
    }

    if (!opts.length) {
      opts.push({
        id: 'actual',
        chip: 'Actual',
        rango: `hasta ${formatFechaDmY(hoy)}`,
        desde: INICIO_HISTORICO,
        hasta: hoy,
      });
    }
    return opts;
  }

  get periodoActivo(): PeriodoOpcion {
    return this.periodos.find((p) => p.id === this.periodoId) || this.periodos[0];
  }

  get cortesDisponibles(): PeriodoOpcion[] {
    return this.periodos.filter((p) => p.id !== 'actual');
  }

  get labelPeriodo(): string {
    const p = this.periodoActivo;
    return p?.rango || '';
  }

  get etiquetaPeriodoActivo(): string {
    const p = this.periodoActivo;
    if (!p) return '';
    if (p.id === 'actual') return `Periodo actual · ${p.rango}`;
    return `Corte ${p.chip} · ${p.rango}`;
  }

  seleccionarPeriodo(id: string): void {
    this.periodoId = id;
    if (id !== 'actual') {
      this.mostrarCortes = false;
    }
    this.syncMovimientosPeriodo(true);
  }

  toggleCortes(): void {
    this.mostrarCortes = !this.mostrarCortes;
  }

  private syncMovimientosPeriodo(reset = false): void {
    const p = this.periodoActivo;
    if (!p) {
      this.movimientosDelPeriodo = [];
    } else {
      this.movimientosDelPeriodo = this.movimientos.filter(
        (m) => m.fecha >= p.desde && m.fecha <= p.hasta
      );
    }
    this.pagHist.setItems(this.movimientosDelPeriodo, reset);
  }

  get totalImporte(): number {
    return Math.round(this.movimientosDelPeriodo.reduce((s, m) => s + this.importeDe(m), 0) * 100) / 100;
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
      next: (v) => {
        this.movimientos = v;
        this.syncMovimientosPeriodo();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar uso en casa'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
    this.api.caja().subscribe({
      next: (c) => {
        this.caja = c;
        if (!this.periodos.some((p) => p.id === this.periodoId)) {
          this.periodoId = 'actual';
        }
        this.syncMovimientosPeriodo();
      },
      error: () => {
        /* sin caja: solo periodo genérico */
      },
    });
  }

  editar(m: Venta): void {
    this.errorEdit = '';
    this.editandoId = m.id;
    this.formEdit = {
      fecha: m.fecha,
      productoId: m.productoId,
      cantidad: m.cantidad,
    };
    this.cdr.detectChanges();
    setTimeout(() => {
      const el =
        document.querySelector('.hist-edicion-movil') || document.querySelector('.fila-edicion');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.errorEdit = '';
    this.guardandoEdit = false;
  }

  guardarEdicion(): void {
    if (this.editandoId == null) return;
    this.errorEdit = '';
    if (!this.formEdit.fecha) {
      this.errorEdit = 'Indica la fecha';
      return;
    }
    if (this.formEdit.fecha > this.hoyLocal()) {
      this.errorEdit = 'No se pueden registrar fechas futuras';
      return;
    }
    const cant = Number(this.formEdit.cantidad);
    if (this.formEdit.productoId == null || !Number.isFinite(cant) || cant <= 0) {
      this.errorEdit = 'Completa producto y cantidad';
      return;
    }
    this.guardandoEdit = true;
    this.api
      .actualizarVenta(this.editandoId, {
        fecha: this.formEdit.fecha,
        productoId: this.formEdit.productoId,
        tipoVenta: 'CASA',
        cantidad: cant,
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          const fechaEdit = this.formEdit.fecha;
          this.cancelarEdicion();
          this.api.usoCasa().subscribe({
            next: (v) => {
              this.movimientos = v;
              this.seleccionarPeriodoDeFecha(fechaEdit);
              this.syncMovimientosPeriodo();
            },
          });
          this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
        },
        error: (e) => {
          this.guardandoEdit = false;
          this.errorEdit = e.error?.error || 'Error al actualizar';
        },
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar este uso en casa?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    if (this.editandoId === id) this.cancelarEdicion();
    this.api.eliminarVenta(id).subscribe({
      next: () => {
        this.cargar();
        this.ok = 'Uso eliminado';
      },
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }
}
