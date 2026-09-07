import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

interface MesUso {
  key: string;
  label: string;
  costo: number;
  cantidad: number;
  registros: number;
}

interface ProductoMes {
  nombre: string;
  cantidad: number;
  costo: number;
}

const MESES_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

@Component({
  selector: 'app-uso-casa',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './uso-casa.component.html',
  styleUrl: './uso-casa.component.scss',
})
export class UsoCasaComponent implements OnInit {
  movimientos: Venta[] = [];
  productos: InventarioItem[] = [];
  error = '';
  /** yyyy-MM seleccionado en el gráfico; null = todos. */
  mesSeleccionado: string | null = null;
  form = {
    fecha: this.hoyLocal(),
    productoId: null as number | null,
    cantidad: null as number | null,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
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
  }

  get totalCosto(): number {
    return this.movimientosVista.reduce((s, m) => s + this.costoDe(m), 0);
  }

  /** Últimos 12 meses con datos (o huecos en cero desde el más viejo al más nuevo). */
  get porMes(): MesUso[] {
    const map = new Map<string, MesUso>();
    for (const m of this.movimientos) {
      const key = m.fecha.slice(0, 7);
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          label: this.labelMes(key),
          costo: 0,
          cantidad: 0,
          registros: 0,
        };
        map.set(key, row);
      }
      row.costo += this.costoDe(m);
      row.cantidad += Number(m.cantidad) || 0;
      row.registros += 1;
    }

    const keys = [...map.keys()].sort();
    if (keys.length === 0) {
      // Mostrar los últimos 6 meses vacíos para que se vea el gráfico
      const hoy = this.hoyLocal().slice(0, 7);
      return this.rangoMeses(hoy, 6).map((key) => ({
        key,
        label: this.labelMes(key),
        costo: 0,
        cantidad: 0,
        registros: 0,
      }));
    }

    const desde = keys[0];
    const hasta = this.hoyLocal().slice(0, 7);
    const todos = this.rangoEntre(desde, hasta);
    // Si hay muchos meses, limitar a 12 recientes
    const visibles = todos.length > 12 ? todos.slice(-12) : todos;
    return visibles.map((key) => {
      const ex = map.get(key);
      return (
        ex ?? {
          key,
          label: this.labelMes(key),
          costo: 0,
          cantidad: 0,
          registros: 0,
        }
      );
    });
  }

  get maxCostoMes(): number {
    const max = Math.max(0, ...this.porMes.map((m) => m.costo));
    return max > 0 ? max : 1;
  }

  get movimientosVista(): Venta[] {
    if (!this.mesSeleccionado) return this.movimientos;
    return this.movimientos.filter((m) => m.fecha.startsWith(this.mesSeleccionado!));
  }

  get productosDelMes(): ProductoMes[] {
    const map = new Map<string, ProductoMes>();
    for (const m of this.movimientosVista) {
      const nombre = m.productoNombre || '—';
      let row = map.get(nombre);
      if (!row) {
        row = { nombre, cantidad: 0, costo: 0 };
        map.set(nombre, row);
      }
      row.cantidad += Number(m.cantidad) || 0;
      row.costo += this.costoDe(m);
    }
    return [...map.values()].sort((a, b) => b.costo - a.costo);
  }

  get labelMesSeleccionado(): string {
    return this.mesSeleccionado ? this.labelMes(this.mesSeleccionado) : 'Todos los meses';
  }

  alturaBarra(costo: number): number {
    return Math.max(2, Math.round((costo / this.maxCostoMes) * 100));
  }

  seleccionarMes(key: string): void {
    this.mesSeleccionado = this.mesSeleccionado === key ? null : key;
  }

  limpiarMes(): void {
    this.mesSeleccionado = null;
  }

  cargar(): void {
    this.api.usoCasa().subscribe({
      next: (v) => (this.movimientos = v),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar uso en casa'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  costoDe(m: Venta): number {
    const p = this.productos.find((x) => x.id === m.productoId);
    return Number(m.cantidad) * (p?.precioCompra ?? 0);
  }

  guardar(): void {
    this.error = '';
    if (this.form.fecha > this.hoyLocal()) {
      this.error = 'No se pueden registrar fechas futuras';
      return;
    }
    if (this.form.productoId == null) {
      this.error = 'Elige un producto';
      return;
    }
    const cant = Number(this.form.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      this.error = 'Indica una cantidad mayor a 0';
      return;
    }
    this.api
      .crearVenta({
        fecha: this.form.fecha,
        productoId: this.form.productoId,
        tipoVenta: 'CASA',
        cantidad: cant,
      })
      .subscribe({
        next: () => {
          this.form = {
            fecha: this.hoyLocal(),
            productoId: null,
            cantidad: null,
          };
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar este uso en casa?');
    if (!ok) return;
    this.api.eliminarVenta(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }

  private labelMes(key: string): string {
    const [y, m] = key.split('-').map(Number);
    return `${MESES_ES[m - 1]}-${y}`;
  }

  private rangoMeses(hastaKey: string, n: number): string[] {
    const out: string[] = [];
    let [y, m] = hastaKey.split('-').map(Number);
    for (let i = 0; i < n; i++) {
      out.unshift(`${y}-${String(m).padStart(2, '0')}`);
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    return out;
  }

  private rangoEntre(desde: string, hasta: string): string[] {
    const out: string[] = [];
    let [y, m] = desde.split('-').map(Number);
    const [yH, mH] = hasta.split('-').map(Number);
    while (y < yH || (y === yH && m <= mH)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
}
