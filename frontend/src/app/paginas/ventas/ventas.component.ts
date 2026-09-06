import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { InventarioItem, TIPOS_VENTA, TipoVenta, Venta } from '../../modelos';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.component.html',
})
export class VentasComponent implements OnInit {
  ventas: Venta[] = [];
  productos: InventarioItem[] = [];
  tipos = TIPOS_VENTA;
  error = '';
  filtro = '';
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    productoId: null as number | null,
    tipoVenta: 'LITROS' as TipoVenta,
    cantidad: 1,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get filtradas(): Venta[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.ventas;
    return this.ventas.filter(
      (v) =>
        (v.productoNombre ?? '').toLowerCase().includes(q) ||
        v.tipoVentaLabel.toLowerCase().includes(q)
    );
  }

  get requiereProducto(): boolean {
    return !['RECARGA', 'PAGO_DE_SERVICIOS'].includes(this.form.tipoVenta);
  }

  cargar(): void {
    this.api.ventas().subscribe({
      next: (v) => (this.ventas = v),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar ventas'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.error = '';
    const body = {
      fecha: this.form.fecha,
      productoId: this.requiereProducto ? this.form.productoId : null,
      tipoVenta: this.form.tipoVenta,
      cantidad: this.form.cantidad,
    };
    this.api.crearVenta(body).subscribe({
      next: () => {
        this.form.cantidad = 1;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar venta'),
    });
  }

  eliminar(id: number): void {
    if (!confirm('¿Eliminar esta venta?')) return;
    this.api.eliminarVenta(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }
}
