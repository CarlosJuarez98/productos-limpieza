import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { Entrada, InventarioItem } from '../../modelos';

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entradas.component.html',
})
export class EntradasComponent implements OnInit {
  entradas: Entrada[] = [];
  productos: InventarioItem[] = [];
  error = '';
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    productoId: null as number | null,
    cantidad: 1,
    precioProveedor: null as number | null,
    actualizarPrecioCompra: true,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.api.entradas().subscribe({
      next: (e) => (this.entradas = e),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar entradas'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.error = '';
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
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar entrada'),
      });
  }

  eliminar(id: number): void {
    if (!confirm('¿Eliminar esta entrada?')) return;
    this.api.eliminarEntrada(id).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al eliminar'),
    });
  }
}
