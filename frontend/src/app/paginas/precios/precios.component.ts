import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { InventarioItem, PrecioHistorico } from '../../modelos';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';

interface PrecioAnterior extends PrecioHistorico {
  vigenteHasta: string | null;
}

interface PrecioActual {
  productoId: number;
  productoNombre: string;
  precioMenudeo: number;
  vigenteDesde: string | null;
}

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmYPipe, ClearableDirective, PaginadorComponent],
  templateUrl: './precios.component.html',
  styleUrl: './precios.component.scss',
})
export class PreciosComponent implements OnInit, OnDestroy {
  precios: PrecioHistorico[] = [];
  productos: InventarioItem[] = [];
  filtro = '';
  filtroTexto = '';
  preciosActuales: PrecioActual[] = [];
  preciosAnteriores: PrecioAnterior[] = [];
  pagActuales = new PaginacionEstado<PrecioActual>();
  pagAnteriores = new PaginacionEstado<PrecioAnterior>();
  error = '';
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
  }

  onFiltroTexto(value: string): void {
    this.filtroTexto = value;
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
    this.filtroTimer = setTimeout(() => {
      this.filtroTimer = null;
      this.filtro = this.filtroTexto;
      this.rebuildListas(true);
    }, 200);
  }

  aplicarBusqueda(): void {
    if (this.filtroTimer != null) {
      clearTimeout(this.filtroTimer);
      this.filtroTimer = null;
    }
    this.filtro = this.filtroTexto;
    this.rebuildListas(true);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }

  onBuscarEnter(ev: Event): void {
    ev.preventDefault();
    this.aplicarBusqueda();
  }

  private rebuildListas(reset = false): void {
    const q = this.filtro.trim().toLowerCase();
    const list = !q
      ? this.productos
      : this.productos.filter((p) => p.nombre.toLowerCase().includes(q));

    this.preciosActuales = [...list]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((p) => {
        const vigente = this.ultimoHistorico(p.id);
        return {
          productoId: p.id,
          productoNombre: p.nombre,
          precioMenudeo: Number(p.precioVentaHoy),
          vigenteDesde: vigente?.fechaVigencia ?? null,
        };
      });

    const idsActuales = new Set(
      this.productos
        .map((p) => this.ultimoHistorico(p.id)?.id)
        .filter((id): id is number => id != null)
    );

    const porProducto = new Map<number, PrecioHistorico[]>();
    for (const p of this.precios) {
      if (idsActuales.has(p.id)) continue;
      if (q && !p.productoNombre.toLowerCase().includes(q)) continue;
      const items = porProducto.get(p.productoId) ?? [];
      items.push(p);
      porProducto.set(p.productoId, items);
    }

    const out: PrecioAnterior[] = [];
    for (const listHist of porProducto.values()) {
      const ordenados = [...listHist].sort((a, b) => {
        const porFecha = b.fechaVigencia.localeCompare(a.fechaVigencia);
        return porFecha !== 0 ? porFecha : b.id - a.id;
      });
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

    this.preciosAnteriores = out.sort((a, b) => {
      const porNombre = a.productoNombre.localeCompare(b.productoNombre, 'es');
      if (porNombre !== 0) return porNombre;
      return b.fechaVigencia.localeCompare(a.fechaVigencia) || b.id - a.id;
    });

    this.pagActuales.setItems(this.preciosActuales, reset);
    this.pagAnteriores.setItems(this.preciosAnteriores, reset);
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
      next: (p) => {
        this.precios = p;
        this.rebuildListas();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar precios'),
    });
    this.api.inventario().subscribe({
      next: (p) => {
        this.productos = p;
        this.rebuildListas();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
    });
  }
}
