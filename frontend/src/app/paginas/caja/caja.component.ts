import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { CajaResumen, TipoMovimientoCaja } from '../../modelos';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './caja.component.html',
})
export class CajaComponent implements OnInit {
  caja: CajaResumen | null = null;
  error = '';
  config = {
    fechaInicio: '',
    fechaFin: '',
    fondoInicial: 0,
  };
  mov = {
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'RETIRO' as TipoMovimientoCaja,
    monto: 0,
    motivo: '',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.api.caja().subscribe({
      next: (c) => {
        this.caja = c;
        this.config = {
          fechaInicio: c.fechaInicio ?? '',
          fechaFin: c.fechaFin ?? '',
          fondoInicial: c.fondoInicial,
        };
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar caja'),
    });
  }

  guardarConfig(): void {
    this.api.actualizarCajaConfig(this.config).subscribe({
      next: () => this.cargar(),
      error: (e) => (this.error = e.error?.error || 'Error al guardar configuración'),
    });
  }

  guardarMovimiento(): void {
    this.api.crearMovimientoCaja(this.mov).subscribe({
      next: () => {
        this.mov.monto = 0;
        this.mov.motivo = '';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar movimiento'),
    });
  }

  eliminar(id: number): void {
    if (!confirm('¿Eliminar movimiento?')) return;
    this.api.eliminarMovimientoCaja(id).subscribe({ next: () => this.cargar() });
  }
}
