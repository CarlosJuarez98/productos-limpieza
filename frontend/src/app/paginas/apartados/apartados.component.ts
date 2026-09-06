import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ApartadosResumen, CategoriaApartado } from '../../modelos';

@Component({
  selector: 'app-apartados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apartados.component.html',
})
export class ApartadosComponent implements OnInit {
  data: ApartadosResumen | null = null;
  error = '';
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    categoria: 'PRODUCTOS' as CategoriaApartado,
    ingreso: 0,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.api.apartados().subscribe({
      next: (d) => (this.data = d),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar apartados'),
    });
  }

  total(cat: CategoriaApartado): number {
    return this.data?.totales?.[cat] ?? 0;
  }

  guardar(): void {
    this.api.crearApartado(this.form).subscribe({
      next: () => {
        this.form.ingreso = 0;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar'),
    });
  }

  eliminar(id: number): void {
    if (!confirm('¿Eliminar apartado?')) return;
    this.api.eliminarApartado(id).subscribe({ next: () => this.cargar() });
  }
}
