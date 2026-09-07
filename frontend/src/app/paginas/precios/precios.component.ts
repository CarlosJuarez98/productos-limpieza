import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, PrecioHistorico } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

interface PrecioAnterior extends PrecioHistorico {
  vigenteHasta: string | null;
}

interface PrecioActual {
  productoId: number;
  productoNombre: string;
  /** Menudeo = mismo valor que Inventario. */
  precioMenudeo: number;
  vigenteDesde: string | null;
  historicoId: number | null;
}

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './precios.component.html',
  styleUrl: './precios.component.scss',
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

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  /** Igual que la columna Menudeo de Inventario. */
  get preciosActuales(): PrecioActual[] {
    const q = this.filtro.trim().toLowerCase();
    const list = !q
      ? this.productos
      : this.productos.filter((p) => p.nombre.toLowerCase().includes(q));

    return [...list]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((p) => {
        const vigente = this.ultimoHistorico(p.id);
        return {
          productoId: p.id,
          productoNombre: p.nombre,
          precioMenudeo: Number(p.precioVentaHoy),
          vigenteDesde: vigente?.fechaVigencia ?? null,
          historicoId: vigente?.id ?? null,
        };
      });
  }

  /** Cambios anteriores (ya no vigentes). */
  get preciosAnteriores(): PrecioAnterior[] {
    const idsActuales = new Set(
      this.productos
        .map((p) => this.ultimoHistorico(p.id)?.id)
        .filter((id): id is number => id != null)
    );

    const q = this.filtro.trim().toLowerCase();
    const porProducto = new Map<number, PrecioHistorico[]>();
    for (const p of this.precios) {
      if (idsActuales.has(p.id)) continue;
      if (q && !p.productoNombre.toLowerCase().includes(q)) continue;
      const list = porProducto.get(p.productoId) ?? [];
      list.push(p);
      porProducto.set(p.productoId, list);
    }

    const out: PrecioAnterior[] = [];
    for (const list of porProducto.values()) {
      const ordenados = [...list].sort((a, b) => {
        const porFecha = b.fechaVigencia.localeCompare(a.fechaVigencia);
        return porFecha !== 0 ? porFecha : b.id - a.id;
      });
      // También ordenamos incluyendo el actual para calcular "hasta"
      const todos = this.precios
        .filter((x) => x.productoId === ordenados[0]?.productoId)
        .sort((a, b) => {
          const porFecha = b.fechaVigencia.localeCompare(a.fechaVigencia);
          return porFecha !== 0 ? porFecha : b.id - a.id;
        });
      for (let i = 0; i < todos.length; i++) {
        if (idsActuales.has(todos[i].id)) continue;
        out.push({
          ...todos[i],
          vigenteHasta: i === 0 ? null : this.diaAnterior(todos[i - 1].fechaVigencia),
        });
      }
    }

    return out.sort((a, b) => {
      const porNombre = a.productoNombre.localeCompare(b.productoNombre, 'es');
      if (porNombre !== 0) return porNombre;
      return b.fechaVigencia.localeCompare(a.fechaVigencia) || b.id - a.id;
    });
  }

  private ultimoHistorico(productoId: number): PrecioHistorico | null {
    const list = this.precios
      .filter((p) => p.productoId === productoId)
      .sort((a, b) => {
        const porFecha = b.fechaVigencia.localeCompare(a.fechaVigencia);
        return porFecha !== 0 ? porFecha : b.id - a.id;
      });
    return list[0] ?? null;
  }

  private diaAnterior(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  cargar(): void {
    this.api.precios().subscribe({
      next: (p) => (this.precios = p),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar precios'),
    });
    this.api.inventario().subscribe({
      next: (p) => (this.productos = p),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
    });
  }

  guardar(): void {
    this.error = '';
    if (this.form.productoId == null) {
      this.error = 'Elige un producto del inventario';
      return;
    }
    this.api.crearPrecio(this.form).subscribe({
      next: () => {
        this.form.precio = 0;
        this.form.productoId = null;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar precio'),
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar precio histórico?');
    if (!ok) return;
    this.api.eliminarPrecio(id).subscribe({ next: () => this.cargar() });
  }
}
