import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, Venta } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

@Component({
  selector: 'app-uso-casa',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './uso-casa.component.html',
})
export class UsoCasaComponent implements OnInit {
  movimientos: Venta[] = [];
  productos: InventarioItem[] = [];
  error = '';
  form = {
    fecha: this.hoyLocal(),
    productoId: null as number | null,
    cantidad: 1,
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
    return this.movimientos.reduce((s, m) => {
      const p = this.productos.find((x) => x.id === m.productoId);
      const compra = p?.precioCompra ?? 0;
      return s + Number(m.cantidad) * compra;
    }, 0);
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
    this.api
      .crearVenta({
        fecha: this.form.fecha,
        productoId: this.form.productoId,
        tipoVenta: 'CASA',
        cantidad: this.form.cantidad,
      })
      .subscribe({
        next: () => {
          this.form.cantidad = 1;
          this.form.productoId = null;
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
}
