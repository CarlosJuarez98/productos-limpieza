import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { Entrada, InventarioItem, Produccion } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './entradas.component.html',
  styleUrl: './entradas.component.scss',
})
export class EntradasComponent implements OnInit {
  entradas: Entrada[] = [];
  producciones: Produccion[] = [];
  productos: InventarioItem[] = [];
  error = '';
  errorPrep = '';
  okPrep = '';
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    productoId: null as number | null,
    cantidad: 1,
    precioProveedor: null as number | null,
    actualizarPrecioCompra: true,
  };
  prep = {
    fecha: new Date().toISOString().slice(0, 10),
    productoResultadoId: null as number | null,
    cantidadResultado: 1 as number | null,
    productoInsumoId: null as number | null,
    cantidadInsumo: 1 as number | null,
    insumoNombre: '' as string,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get productosPreparables(): InventarioItem[] {
    return this.productos.filter((p) => {
      const n = p.nombre.toLowerCase();
      return n === 'cloro' || n.startsWith('fabuloso ');
    });
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
  }

  onResultadoChange(id: number | null): void {
    this.prep.productoResultadoId = id;
    this.prep.productoInsumoId = null;
    this.prep.insumoNombre = '';
    if (id == null) return;
    this.api.recetaProduccion(id).subscribe({
      next: (r) => {
        if (r.encontrada && r.productoInsumoId != null) {
          this.prep.productoInsumoId = r.productoInsumoId;
          this.prep.insumoNombre = r.productoInsumoNombre ?? '';
          if (this.prep.cantidadResultado != null) {
            this.prep.cantidadInsumo = this.prep.cantidadResultado;
          }
        } else {
          this.errorPrep = 'No hay receta para ese producto (Cloro←Hipoclorito o Fabuloso←Base)';
        }
      },
    });
  }

  onCantidadResultadoChange(): void {
    if (this.prep.cantidadResultado != null && this.prep.productoInsumoId != null) {
      this.prep.cantidadInsumo = this.prep.cantidadResultado;
    }
  }

  guardar(): void {
    this.error = '';
    if (this.form.productoId == null) {
      this.error = 'Elige un producto del inventario';
      return;
    }
    this.api
      .crearEntrada({
        fecha: this.form.fecha,
        productoId: this.form.productoId,
        cantidad: this.form.cantidad,
        precioProveedor: this.form.precioProveedor,
        actualizarPrecioCompra: this.form.actualizarPrecioCompra,
      })
      .subscribe({
        next: () => {
          this.form.cantidad = 1;
          this.form.precioProveedor = null;
          this.form.productoId = null;
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar entrada'),
      });
  }

  guardarPreparacion(): void {
    this.errorPrep = '';
    this.okPrep = '';
    if (
      this.prep.productoResultadoId == null ||
      this.prep.productoInsumoId == null ||
      this.prep.cantidadResultado == null ||
      this.prep.cantidadInsumo == null ||
      this.prep.cantidadResultado <= 0 ||
      this.prep.cantidadInsumo <= 0
    ) {
      this.errorPrep = 'Completa producto, insumo y cantidades';
      return;
    }
    this.api
      .crearProduccion({
        fecha: this.prep.fecha,
        productoResultadoId: this.prep.productoResultadoId,
        cantidadResultado: this.prep.cantidadResultado,
        productoInsumoId: this.prep.productoInsumoId,
        cantidadInsumo: this.prep.cantidadInsumo,
      })
      .subscribe({
        next: () => {
          this.okPrep = `Listo: +${this.prep.cantidadResultado} y se descontó ${this.prep.cantidadInsumo} de ${this.prep.insumoNombre}`;
          this.prep.cantidadResultado = 1;
          this.prep.cantidadInsumo = 1;
          this.prep.productoResultadoId = null;
          this.prep.productoInsumoId = null;
          this.prep.insumoNombre = '';
          this.cargar();
        },
        error: (e) => (this.errorPrep = e.error?.error || 'Error al registrar preparación'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta entrada?');
    if (!ok) return;
    this.api.eliminarEntrada(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }

  async eliminarProduccion(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar esta preparación?');
    if (!ok) return;
    this.api.eliminarProduccion(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.errorPrep = e.error?.error || 'Error al eliminar'),
    });
  }
}