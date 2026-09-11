import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { ClearableDirective } from './clearable.directive';
import { InventarioItem, MargenConfig } from './modelos';

type FormAlta = {
  nombre: string;
  precioCompra: number | null;
  totalPagado: number | null;
  cantidadInicial: number | null;
  precioVenta: number | null;
  precioMayoreo5: number | null;
  precioMayoreo10: number | null;
  vendePor: 'LITROS' | 'PIEZA';
};

@Component({
  selector: 'app-producto-alta-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ClearableDirective],
  templateUrl: './producto-alta-form.component.html',
  styleUrl: './producto-alta-form.component.scss',
})
export class ProductoAltaFormComponent implements OnInit {
  /** Prefijo único para names de inputs (varios formularios en la misma página). */
  @Input() namePrefix = 'alta';
  @Input() submitLabel = 'Agregar producto nuevo';
  @Input() nombreInicial = '';
  @Output() creado = new EventEmitter<InventarioItem>();
  @Output() cancelado = new EventEmitter<void>();

  form: FormAlta = this.vacio();
  error = '';
  guardando = false;
  private pct = { mayoreo5: 40, mayoreo10: 30, min: 46.5, max: 63 };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.nombreInicial?.trim()) {
      this.form.nombre = this.nombreInicial.trim();
    }
    this.api.margenes().subscribe({
      next: (m: MargenConfig) => {
        this.pct.mayoreo5 = Number(m.porcentajeMayoreo5) || 40;
        this.pct.mayoreo10 = Number(m.porcentajeMayoreo10) || 30;
        this.pct.min = Number(m.porcentajeMin) || 46.5;
        this.pct.max = Number(m.porcentajeMax) || 63;
      },
    });
  }

  get cantidadEfectiva(): number | null {
    const raw = this.form.cantidadInicial;
    if (raw == null || String(raw).trim() === '') return 1;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  get unitario(): number | null {
    const cant = this.cantidadEfectiva;
    const total = Number(this.form.totalPagado);
    if (cant == null || cant <= 0) return null;
    if (this.form.totalPagado == null || String(this.form.totalPagado).trim() === '') return null;
    if (!Number.isFinite(total) || total < 0) return null;
    return Math.round((total / cant) * 100) / 100;
  }

  get completa(): boolean {
    const f = this.form;
    if (!f.nombre?.trim()) return false;
    if (!f.vendePor) return false;
    const cant = this.cantidadEfectiva;
    if (cant == null || cant <= 0) return false;
    if (f.totalPagado == null || String(f.totalPagado).trim() === '') return false;
    if (!Number.isFinite(Number(f.totalPagado)) || Number(f.totalPagado) <= 0) return false;
    if (this.unitario == null || this.unitario <= 0) return false;
    if (f.precioVenta == null || String(f.precioVenta).trim() === '') return false;
    if (!Number.isFinite(Number(f.precioVenta)) || Number(f.precioVenta) <= 0) return false;
    return true;
  }

  get menudeoPlaceholder(): string {
    const u = this.unitario;
    if (u == null || u <= 0) return 'Según unitario';
    const min = Math.round(u * (1 + this.pct.min / 100) * 100) / 100;
    const max = Math.round(u * (1 + this.pct.max / 100) * 100) / 100;
    return `mín $${min} – máx $${max}`;
  }

  onCantidadChange(valor: string | number | null): void {
    this.form.cantidadInicial = valor === '' || valor == null ? null : (valor as number | null);
    this.sincronizarUnitario();
  }

  onTotalChange(valor: string | number | null): void {
    this.form.totalPagado = valor === '' || valor == null ? null : (valor as number | null);
    this.sincronizarUnitario();
  }

  onMenudeoChange(): void {
    this.calcularMayoreo();
  }

  guardar(): void {
    this.error = '';
    if (!this.completa) {
      this.error = 'Completa nombre, total pagado y menudeo';
      return;
    }
    this.sincronizarUnitario();
    this.form.precioCompra = this.unitario;
    this.calcularMayoreo();
    const cant = this.cantidadEfectiva ?? 1;
    const body = {
      nombre: this.form.nombre.trim(),
      precioCompra: Number(this.form.precioCompra) || 0,
      cantidadInicial: cant,
      precioMayoreo5: this.form.precioMayoreo5,
      precioMayoreo10: this.form.precioMayoreo10,
      precioVenta: this.form.precioVenta,
      vendePor: this.form.vendePor || 'LITROS',
    };
    this.guardando = true;
    this.api.crearProducto(body).subscribe({
      next: (item) => {
        this.guardando = false;
        this.form = this.vacio();
        this.creado.emit(item);
      },
      error: (e) => {
        this.guardando = false;
        this.error = e.error?.error || 'Error al guardar producto';
      },
    });
  }

  private sincronizarUnitario(): void {
    this.form.precioCompra = this.unitario;
    if (this.form.precioVenta != null && Number(this.form.precioVenta) > 0) {
      this.calcularMayoreo();
    }
  }

  private calcularMayoreo(): void {
    const c = Number(this.form.precioCompra) || 0;
    if (c <= 0) return;
    this.form.precioMayoreo5 = Math.round(c * (1 + this.pct.mayoreo5 / 100) * 100) / 100;
    this.form.precioMayoreo10 = Math.round(c * (1 + this.pct.mayoreo10 / 100) * 100) / 100;
  }

  private vacio(): FormAlta {
    return {
      nombre: '',
      precioCompra: null,
      totalPagado: null,
      cantidadInicial: null,
      precioVenta: null,
      precioMayoreo5: null,
      precioMayoreo10: null,
      vendePor: 'LITROS',
    };
  }
}
