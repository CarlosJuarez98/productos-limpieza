import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, TraspasosResumen } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

@Component({
  selector: 'app-traspasos',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './traspasos.component.html',
})
export class TraspasosComponent implements OnInit {
  data: TraspasosResumen | null = null;
  productos: InventarioItem[] = [];
  error = '';
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    productoId: null as number | null,
    cantidad: 1,
    persona: 'Mamá',
    nota: '',
  };
  abono = {
    fecha: new Date().toISOString().slice(0, 10),
    monto: 0,
    persona: 'Mamá',
    nota: '',
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get precioCompraSel(): number {
    const p = this.productos.find((x) => x.id === this.form.productoId);
    return p?.precioCompra ?? 0;
  }

  get totalEstimado(): number {
    return Number(this.form.cantidad || 0) * this.precioCompraSel;
  }

  cargar(): void {
    this.api.traspasos().subscribe({
      next: (d) => (this.data = d),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar traspasos'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.error = '';
    if (this.form.productoId == null) {
      this.error = 'Elige un producto';
      return;
    }
    this.api
      .crearTraspaso({
        fecha: this.form.fecha,
        productoId: this.form.productoId,
        cantidad: this.form.cantidad,
        persona: this.form.persona,
        nota: this.form.nota || null,
      })
      .subscribe({
        next: () => {
          this.form.cantidad = 1;
          this.form.productoId = null;
          this.form.nota = '';
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar traspaso'),
      });
  }

  guardarAbono(): void {
    this.error = '';
    if (!this.abono.monto || this.abono.monto <= 0) {
      this.error = 'Indica el monto del abono';
      return;
    }
    this.api
      .crearAbonoTraspaso({
        fecha: this.abono.fecha,
        monto: this.abono.monto,
        persona: this.abono.persona,
        nota: this.abono.nota || null,
      })
      .subscribe({
        next: () => {
          this.abono.monto = 0;
          this.abono.nota = '';
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar abono'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar traspaso?');
    if (!ok) return;
    this.api.eliminarTraspaso(id).subscribe({ next: () => this.cargar() });
  }

  async eliminarAbono(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar abono?');
    if (!ok) return;
    this.api.eliminarAbonoTraspaso(id).subscribe({ next: () => this.cargar() });
  }
}
