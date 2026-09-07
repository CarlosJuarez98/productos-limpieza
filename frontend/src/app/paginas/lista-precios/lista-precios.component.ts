import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ApiService } from '../../api.service';
import { InventarioItem } from '../../modelos';

@Component({
  selector: 'app-lista-precios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-precios.component.html',
})
export class ListaPreciosComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
  hoy = new Date().toLocaleDateString('es-MX');

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.inventario().subscribe({ next: (i) => (this.items = i) });
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
  }

  /** Descarga Excel con la lista actual de productos y precios. */
  descargarExcel(): void {
    const filas = this.filtrados.map((i) => ({
      Producto: i.nombre,
      Menudeo: Number(i.precioVentaHoy),
      '≥ 5 L': Number(i.precioMayoreo5),
      '≥ 10 L': Number(i.precioMayoreo10),
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista precios');

    const stamp = this.fechaArchivo();
    XLSX.writeFile(wb, `lista-precios-${stamp}.xlsx`);
  }

  private fechaArchivo(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
