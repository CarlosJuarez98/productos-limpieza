import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { PageAlertsComponent } from './page-alerts.component';
import { ClearableDirective } from './clearable.directive';
import { SoloNumerosDirective } from './solo-numeros.directive';
import { InventarioItem, MargenConfig, etiquetaPrecioUnidad } from './modelos';
import { noBajoCompra, precioConDescuentoEntero, precioConMargenArriba } from './captura-focus.util';

type FormAlta = {
  nombre: string;
  precioCompra: number | null;
  totalPagado: number | null;
  cantidadInicial: number | null;
  precioVenta: number | null;
  precioMayoreo5: number | null;
  precioMayoreo10: number | null;
  vendePor: 'LITROS' | 'PIEZA';
  departamento: 'LIMPIEZA' | 'JARCERIA';
};

type TipoBaston = 'NA' | 'FALTA' | 'TRAE';

@Component({
  selector: 'app-producto-alta-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ClearableDirective, SoloNumerosDirective, PageAlertsComponent],
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
  /** NA por defecto: no entra a lista Armar. */
  tipoBaston: TipoBaston = 'NA';
  error = '';
  guardando = false;
  private costoBaston = 0;
  private bastonProductoId: number | null = null;
  private pct: {
    mayoreo5: number | null;
    mayoreo10: number | null;
    min: number;
    max: number;
  } = { mayoreo5: null, mayoreo10: null, min: 46.5, max: 63 };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.nombreInicial?.trim()) {
      this.form.nombre = this.nombreInicial.trim();
    }
    this.api.margenes().subscribe({
      next: (m: MargenConfig) => {
        this.pct.mayoreo5 = m.porcentajeMayoreo5 == null ? null : Number(m.porcentajeMayoreo5);
        this.pct.mayoreo10 = m.porcentajeMayoreo10 == null ? null : Number(m.porcentajeMayoreo10);
        this.pct.min = Number(m.porcentajeMin) || 46.5;
        this.pct.max = Number(m.porcentajeMax) || 63;
      },
    });
    this.api.inventario().subscribe({
      next: (list) => {
        const b =
          (list || []).find((i) => i.esBaston) ||
          (list || []).find((i) => /bast[oó]n/i.test(i.nombre || ''));
        this.costoBaston = Number(b?.precioCompra) || 0;
        this.bastonProductoId = b?.id ?? null;
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

  /** Compra de catálogo: con Falta armar = cabeza + bastón. */
  get compraCatalogo(): number | null {
    const u = this.unitario;
    if (u == null || u <= 0) return null;
    if (this.tipoBaston !== 'FALTA' || !(this.costoBaston > 0)) return u;
    return Math.round((u + this.costoBaston) * 100) / 100;
  }

  get etiquetaPrecio(): string {
    return etiquetaPrecioUnidad(this.form.vendePor);
  }

  get completa(): boolean {
    const f = this.form;
    if (!f.nombre?.trim()) return false;
    if (!f.vendePor || !f.departamento) return false;
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
    const base = this.compraCatalogo ?? this.unitario;
    if (base == null || base <= 0) return 'Según unitario';
    const min = precioConMargenArriba(base, this.pct.min);
    const max = precioConMargenArriba(base, this.pct.max);
    return `mín $${min} – máx $${max}`;
  }

  setTipoBaston(tipo: TipoBaston): void {
    this.tipoBaston = tipo;
    if (tipo !== 'NA') {
      this.form.vendePor = 'PIEZA';
    }
    this.onMenudeoChange();
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
    const compraCat = this.compraCatalogo;
    if (compraCat == null || compraCat <= 0) {
      this.error = 'No se pudo calcular el precio unitario';
      return;
    }
    // Backend recibe la cabeza; si Falta armar, suma bastón allá.
    this.form.precioCompra = this.unitario;
    if (Number(this.form.precioVenta) < compraCat) {
      this.error =
        this.tipoBaston === 'FALTA'
          ? 'El menudeo no puede ser menor a compra (cabeza + bastón)'
          : 'El menudeo no puede ser menor al precio de compra';
      return;
    }
    const guardada = this.form.precioCompra;
    this.form.precioCompra = compraCat;
    this.calcularMayoreo();
    this.form.precioCompra = guardada;
    if (
      this.form.precioMayoreo5 != null &&
      Number(this.form.precioMayoreo5) < compraCat
    ) {
      this.error = 'El mayoreo ≥5 no puede ser menor al precio de compra';
      return;
    }
    if (
      this.form.precioMayoreo10 != null &&
      Number(this.form.precioMayoreo10) < compraCat
    ) {
      this.error = 'El mayoreo ≥10 no puede ser menor al precio de compra';
      return;
    }
    const cant = this.cantidadEfectiva ?? 1;
    const usaBaston = this.tipoBaston !== 'NA';
    const body = {
      nombre: this.form.nombre.trim(),
      precioCompra: Number(this.form.precioCompra) || 0,
      cantidadInicial: cant,
      precioMayoreo5: this.form.precioMayoreo5,
      precioMayoreo10: this.form.precioMayoreo10,
      precioVenta: this.form.precioVenta,
      vendePor: this.form.vendePor || 'LITROS',
      departamento: this.form.departamento || 'LIMPIEZA',
      usaBaston,
      esBaston: false,
      bastonesPorUnidad: usaBaston ? 1 : 1,
      bastonProductoId: usaBaston ? this.bastonProductoId : null,
      traeBastonIncluido:
        this.tipoBaston === 'TRAE' ? true : this.tipoBaston === 'FALTA' ? false : null,
    };
    this.guardando = true;
    this.api.crearProducto(body).subscribe({
      next: (item) => {
        this.guardando = false;
        this.form = this.vacio();
        this.tipoBaston = 'NA';
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
    const menudeo = Number(this.form.precioVenta) || 0;
    const compra = this.compraCatalogo || Number(this.form.precioCompra) || this.unitario || 0;
    if (menudeo <= 0) return;
    if (this.pct.mayoreo5 != null) {
      this.form.precioMayoreo5 = noBajoCompra(
        precioConDescuentoEntero(menudeo, this.pct.mayoreo5),
        compra
      );
    }
    if (this.pct.mayoreo10 != null) {
      this.form.precioMayoreo10 = noBajoCompra(
        precioConDescuentoEntero(menudeo, this.pct.mayoreo10),
        compra
      );
    }
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
      departamento: 'LIMPIEZA',
    };
  }
}
