import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ExcelJS from 'exceljs';
import { ApiService } from '../../api.service';
import { ClearableDirective } from '../../clearable.directive';
import { InventarioItem } from '../../modelos';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Component({
  selector: 'app-lista-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, ClearableDirective, PaginadorComponent],
  templateUrl: './lista-precios.component.html',
  styleUrl: './lista-precios.component.scss',
})
export class ListaPreciosComponent implements OnInit, OnDestroy {
  items: InventarioItem[] = [];
  filtro = '';
  filtroTexto = '';
  filtrados: InventarioItem[] = [];
  pag = new PaginacionEstado<InventarioItem>();
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;
  /** Título de pantalla / exportación. */
  readonly marca = 'Productos de limpieza AMORCAS';
  fechaLista = this.fechaListaLarga();
  exportando = false;

  /** Mayoreos opcionales; menudeo siempre va en el Excel. */
  cols = {
    mayoreo5: false,
    mayoreo10: false,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.inventario().subscribe({
      next: (i) => {
        this.items = i;
        this.rebuildFiltrados();
      },
    });
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
      this.rebuildFiltrados(true);
    }, 200);
  }

  aplicarBusqueda(): void {
    if (this.filtroTimer != null) {
      clearTimeout(this.filtroTimer);
      this.filtroTimer = null;
    }
    this.filtro = this.filtroTexto;
    this.rebuildFiltrados(true);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }

  onBuscarEnter(ev: Event): void {
    ev.preventDefault();
    this.aplicarBusqueda();
  }

  private rebuildFiltrados(reset = false): void {
    const q = this.filtro.trim().toLowerCase();
    this.filtrados = !q ? this.items : this.items.filter((i) => i.nombre.toLowerCase().includes(q));
    this.pag.setItems(this.filtrados, reset);
  }

  /** Exporta la lista actual desde la BD (inventario + precios vigentes). */
  async exportarLista(): Promise<void> {
    if (this.exportando) return;
    this.exportando = true;
    try {
      const headers = ['Producto', 'Menudeo'];
      if (this.cols.mayoreo5) headers.push('≥ 5 L');
      if (this.cols.mayoreo10) headers.push('≥ 10 L');
      const colCount = headers.length;

      const wb = new ExcelJS.Workbook();
      wb.creator = 'AMORCAS';
      const ws = wb.addWorksheet('Lista precios', {
        views: [{ showGridLines: true }],
      });

      const logoH = 56;
      let logoW = 56;
      try {
        const logoBuf = await this.cargarLogo();
        if (logoBuf) {
          const dims = await this.dimsLogoProporcional(logoBuf, logoH);
          logoW = dims.w;
          const logoId = wb.addImage({
            buffer: logoBuf,
            extension: 'png',
          });
          // Logo en col A, nombre del negocio a la derecha (misma fila).
          ws.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: dims.w, height: dims.h },
          });
        }
      } catch {
        // Sin logo: sigue el export con texto
      }

      // Ancho aprox. de columna A para el logo (excel: ~7px por unidad de width)
      ws.getColumn(1).width = Math.max(12, Math.ceil(logoW / 7) + 1);
      ws.getRow(1).height = Math.max(48, logoH * 0.85);

      ws.mergeCells(1, 2, 1, Math.max(2, colCount));
      const titulo = ws.getCell(1, 2);
      titulo.value = this.marca;
      titulo.font = { bold: true, size: 18, color: { argb: 'FF163528' } };
      titulo.alignment = { vertical: 'middle', horizontal: 'left' };

      ws.mergeCells(2, 2, 2, Math.max(2, colCount));
      const sub = ws.getCell(2, 2);
      sub.value = `Lista de precios · ${this.fechaLista}`;
      sub.font = { bold: true, size: 12, color: { argb: 'FF2D4A3C' } };
      sub.alignment = { vertical: 'middle', horizontal: 'left' };

      const headerRowIdx = 4;
      const headerRow = ws.getRow(headerRowIdx);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 11 };
        cell.alignment = { horizontal: i === 0 ? 'left' : 'center' };
      });
      headerRow.commit();

      let r = headerRowIdx + 1;
      for (const item of this.filtrados) {
        const row = ws.getRow(r);
        row.getCell(1).value = item.nombre;
        this.celdaMoneda(row.getCell(2), item.precioVentaHoy, true);
        let c = 3;
        if (this.cols.mayoreo5) {
          this.celdaMoneda(row.getCell(c), item.precioMayoreo5, false);
          c++;
        }
        if (this.cols.mayoreo10) {
          this.celdaMoneda(row.getCell(c), item.precioMayoreo10, false);
        }
        r++;
      }

      for (let i = 2; i <= colCount; i++) {
        ws.getColumn(i).width = 14;
      }
      // Producto más ancho (col 1 ya tiene logo width; en filas de datos es el nombre)
      ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 12, 36);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const nombre = `lista de precios AMORCAS ${this.fechaLista.replace(/\//g, '-')}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exportando = false;
    }
  }

  private async cargarLogo(): Promise<ArrayBuffer | null> {
    const res = await fetch('amorcas-logo.png', { cache: 'force-cache' });
    if (!res.ok) return null;
    return res.arrayBuffer();
  }

  /** Escala el logo a altura fija manteniendo proporción. */
  private async dimsLogoProporcional(
    buf: ArrayBuffer,
    maxAlto: number
  ): Promise<{ w: number; h: number }> {
    const blob = new Blob([buf], { type: 'image/png' });
    const bmp = await createImageBitmap(blob);
    const scale = maxAlto / Math.max(1, bmp.height);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    bmp.close();
    return { w, h };
  }

  private celdaMoneda(
    cell: ExcelJS.Cell,
    valor: number | null | undefined,
    negrita: boolean
  ): void {
    const n = Number(valor);
    cell.value = Number.isFinite(n) ? n : 0;
    cell.numFmt = '"$"#,##0.00';
    cell.font = { bold: negrita, size: 11 };
    cell.alignment = { horizontal: 'right' };
  }

  private fechaListaLarga(): string {
    const d = new Date();
    return `${d.getDate()}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
  }
}
