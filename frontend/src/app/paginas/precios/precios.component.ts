import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { InventarioItem, PrecioHistorico } from '../../modelos';

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './precios.component.html',
})
export class PreciosComponent implements OnInit {
  precios: PrecioHistorico[] = [];
  productos: InventarioItem[] = [];
  filtro = '';
  error = '';
  form = {
    productoId: null as number | null,
    fechaVigencia: new Date().toISOString().slice(0, 10),
    precio: 0,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get filtrados(): PrecioHistorico[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.precios;
    return this.precios.filter((p) => p.productoNombre.toLowerCase().includes(q));
  }

  cargar(): void {
    this.api.precios().subscribe({
      next: (p) => (this.precios = p),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar precios'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.api.crearPrecio(this.form).subscribe({
      next: () => {
        this.form.precio = 0;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar precio'),
    });
  }

  eliminar(id: number): void {
    if (!confirm('¿Eliminar precio histórico?')) return;
    this.api.eliminarPrecio(id).subscribe({ next: () => this.cargar() });
  }
}
