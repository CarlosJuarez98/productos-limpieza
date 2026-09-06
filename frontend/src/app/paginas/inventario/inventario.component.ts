import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { InventarioItem } from '../../modelos';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.component.html',
})
export class InventarioComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
  error = '';
  editando: InventarioItem | null = null;
  form = {
    nombre: '',
    precioCompra: 0,
    cantidadInicial: 0,
    precioVenta: null as number | null,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
  }

  cargar(): void {
    this.api.inventario().subscribe({
      next: (i) => (this.items = i),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
    });
  }

  guardar(): void {
    this.error = '';
    const body = {
      nombre: this.form.nombre,
      precioCompra: this.form.precioCompra,
      cantidadInicial: this.form.cantidadInicial,
      precioVenta: this.form.precioVenta,
      fechaVigenciaPrecio: new Date().toISOString().slice(0, 10),
    };
    const req = this.editando
      ? this.api.actualizarProducto(this.editando.id, body)
      : this.api.crearProducto(body);
    req.subscribe({
      next: () => {
        this.editando = null;
        this.form = { nombre: '', precioCompra: 0, cantidadInicial: 0, precioVenta: null };
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
    };
  }

  cancelar(): void {
    this.editando = null;
    this.form = { nombre: '', precioCompra: 0, cantidadInicial: 0, precioVenta: null };
  }
}
