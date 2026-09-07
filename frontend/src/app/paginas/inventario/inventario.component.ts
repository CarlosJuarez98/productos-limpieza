import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, MargenConfig } from '../../modelos';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss',
})
export class InventarioComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
  error = '';
  ok = '';
  guardandoMargen = false;
  editando: InventarioItem | null = null;
  margen: MargenConfig = {
    margenMin: 0.465,
    margenMax: 0.63,
    margenMayoreo5: 0.4,
    margenMayoreo10: 0.3,
    porcentajeMin: 46.5,
    porcentajeMax: 63,
    porcentajeMayoreo5: 40,
    porcentajeMayoreo10: 30,
  };
  /** Valores editables en % (inputs). */
  pct = {
    min: 46.5,
    max: 63,
    mayoreo5: 40,
    mayoreo10: 30,
  };
  form = {
    nombre: '',
    precioCompra: 0,
    cantidadInicial: 0,
    precioVenta: null as number | null,
    precioMayoreo5: null as number | null,
    precioMayoreo10: null as number | null,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
  }

  /** Guía al dar de alta: compra × (1 + % mín/máx). */
  get sugeridoMinForm(): number {
    const c = Number(this.form.precioCompra) || 0;
    if (c <= 0) return 0;
    return Math.round(c * (1 + Number(this.pct.min) / 100) * 100) / 100;
  }

  get sugeridoMaxForm(): number {
    const c = Number(this.form.precioCompra) || 0;
    if (c <= 0) return 0;
    return Math.round(c * (1 + Number(this.pct.max) / 100) * 100) / 100;
  }

  get sugeridoPlaceholder(): string {
    if (this.sugeridoMinForm <= 0) return '';
    return `${this.sugeridoMinForm} – ${this.sugeridoMaxForm}`;
  }

  onCompraChange(): void {
    // Si ya hay menudeo, refresca mayoreo; si no, solo actualiza la guía (getters).
    if (this.form.precioVenta != null && Number(this.form.precioVenta) > 0) {
      this.calcularMayoreoDesdeCompra();
    }
  }

  onMenudeoChange(): void {
    if (this.form.precioVenta == null || Number(this.form.precioVenta) <= 0) {
      if (!this.editando) {
        this.form.precioMayoreo5 = null;
        this.form.precioMayoreo10 = null;
      }
      return;
    }
    this.calcularMayoreoDesdeCompra();
  }

  usarSugerido(precio: number): void {
    this.form.precioVenta = precio;
    this.onMenudeoChange();
  }

  /** Mayoreo = compra × (1 + % mayoreo), igual que en backend. */
  private calcularMayoreoDesdeCompra(): void {
    const c = Number(this.form.precioCompra) || 0;
    if (c <= 0) return;
    this.form.precioMayoreo5 =
      Math.round(c * (1 + Number(this.pct.mayoreo5) / 100) * 100) / 100;
    this.form.precioMayoreo10 =
      Math.round(c * (1 + Number(this.pct.mayoreo10) / 100) * 100) / 100;
  }

  cargar(): void {
    this.api.inventario().subscribe({
      next: (i) => (this.items = i),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
    });
    this.api.margenes().subscribe({
      next: (m) => {
        this.margen = m;
        this.pct = {
          min: Number(m.porcentajeMin),
          max: Number(m.porcentajeMax),
          mayoreo5: Number(m.porcentajeMayoreo5),
          mayoreo10: Number(m.porcentajeMayoreo10),
        };
      },
    });
  }

  aplicarMargenesManuales(): void {
    this.normalizarPct();
    this.guardarMargenes();
  }

  private normalizarPct(): void {
    this.pct.min = Math.max(0, +Number(this.pct.min).toFixed(1));
    this.pct.max = Math.max(0, +Number(this.pct.max).toFixed(1));
    this.pct.mayoreo5 = Math.max(0, +Number(this.pct.mayoreo5).toFixed(1));
    this.pct.mayoreo10 = Math.max(0, +Number(this.pct.mayoreo10).toFixed(1));
    if (this.pct.min > this.pct.max) this.pct.max = this.pct.min;
    if (this.pct.mayoreo10 > this.pct.mayoreo5) this.pct.mayoreo5 = this.pct.mayoreo10;
  }

  guardarMargenes(): void {
    this.error = '';
    this.ok = '';
    this.guardandoMargen = true;
    this.api
      .actualizarMargenes({
        porcentajeMin: this.pct.min,
        porcentajeMax: this.pct.max,
        porcentajeMayoreo5: this.pct.mayoreo5,
        porcentajeMayoreo10: this.pct.mayoreo10,
      })
      .subscribe({
        next: (m) => {
          this.margen = m;
          this.pct = {
            min: Number(m.porcentajeMin),
            max: Number(m.porcentajeMax),
            mayoreo5: Number(m.porcentajeMayoreo5),
            mayoreo10: Number(m.porcentajeMayoreo10),
          };
          this.guardandoMargen = false;
          this.ok = 'Márgenes guardados (precios actuales no se modificaron)';
          this.cargar();
        },
        error: (e) => {
          this.guardandoMargen = false;
          this.error = e.error?.error || 'No se pudieron guardar los márgenes';
        },
      });
  }

  async aplicarPreciosDesdeMargenes(): Promise<void> {
    this.normalizarPct();
    const ok = await this.confirmDlg.ask(
      '¿Sobrescribir TODOS los precios menudeo y mayoreo con el cálculo de márgenes? Se perderán tus precios actuales.'
    );
    if (!ok) return;
    this.error = '';
    this.ok = '';
    this.guardandoMargen = true;
    this.api
      .actualizarMargenes({
        porcentajeMin: this.pct.min,
        porcentajeMax: this.pct.max,
        porcentajeMayoreo5: this.pct.mayoreo5,
        porcentajeMayoreo10: this.pct.mayoreo10,
      })
      .subscribe({
        next: () => {
          this.api.aplicarPreciosDesdeMargenes().subscribe({
            next: (m) => {
              this.margen = m;
              this.guardandoMargen = false;
              this.ok = 'Precios recalculados desde márgenes';
              this.cargar();
            },
            error: (e) => {
              this.guardandoMargen = false;
              this.error = e.error?.error || 'No se pudieron aplicar los precios';
            },
          });
        },
        error: (e) => {
          this.guardandoMargen = false;
          this.error = e.error?.error || 'No se pudieron guardar los márgenes';
        },
      });
  }

  guardar(): void {
    this.error = '';
    const body = {
      nombre: this.form.nombre,
      precioCompra: this.form.precioCompra,
      cantidadInicial: this.form.cantidadInicial,
      precioVenta: this.form.precioVenta,
      precioMayoreo5: this.form.precioMayoreo5,
      precioMayoreo10: this.form.precioMayoreo10,
    };
    const req = this.editando
      ? this.api.actualizarProducto(this.editando.id, body)
      : this.api.crearProducto(body);
    req.subscribe({
      next: () => {
        this.editando = null;
        this.form = {
          nombre: '',
          precioCompra: 0,
          cantidadInicial: 0,
          precioVenta: null,
          precioMayoreo5: null,
          precioMayoreo10: null,
        };
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar producto'),
    });
  }

  editar(item: InventarioItem): void {
    this.editando = item;
    this.form = {
      nombre: item.nombre,
      precioCompra: item.precioCompra,
      cantidadInicial: item.cantidadInicial,
      precioVenta: item.precioVentaHoy,
      precioMayoreo5: item.precioMayoreo5,
      precioMayoreo10: item.precioMayoreo10,
    };
  }

  cancelar(): void {
    this.editando = null;
    this.form = {
      nombre: '',
      precioCompra: 0,
      cantidadInicial: 0,
      precioVenta: null,
      precioMayoreo5: null,
      precioMayoreo10: null,
    };
  }
}
