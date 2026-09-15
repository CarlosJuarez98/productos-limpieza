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

  toggleCol(which: 'mayoreo5' | 'mayoreo10'): void {
    this.cols[which] = !this.cols[which];
  }

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

      // Nombre ancho; precios angostos e iguales (fácil de escanear).
      const anchoPrecio = 12;
      ws.getColumn(1).width = 38;
      for (let i = 2; i <= colCount; i++) {
        ws.getColumn(i).width = anchoPrecio;
      }

      const logoH = 78;
      try {
        const logoBuf = await this.cargarLogo();
        if (logoBuf) {
          const dims = await this.dimsLogoProporcional(logoBuf, logoH);
          const logoId = wb.addImage({
            buffer: logoBuf,
            extension: 'png',
          });
          // Columna extra a la derecha del bloque de datos, justo después del título.
          ws.getColumn(colCount + 1).width = Math.max(12, Math.ceil(dims.w / 7) + 1);
          ws.addImage(logoId, {
            tl: { col: colCount, row: 0 },
            ext: { width: dims.w, height: dims.h },
          });
        }
      } catch {
        // Sin logo: sigue el export con texto
      }

      ws.getRow(1).height = Math.max(60, logoH * 0.78);
      ws.getRow(2).height = 20;

      // Título y subtítulo combinan todas las columnas de datos (2, 3 o 4).
      if (colCount > 1) {
        ws.mergeCells(1, 1, 1, colCount);
        ws.mergeCells(2, 1, 2, colCount);
      }
      const titulo = ws.getCell(1, 1);
      titulo.value = this.marca;
      titulo.font = { bold: true, size: 18, color: { argb: 'FF163528' } };
      titulo.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

      const sub = ws.getCell(2, 1);
      sub.value = `Lista de precios · ${this.fechaLista}`;
      sub.font = { bold: true, size: 12, color: { argb: 'FF2D4A3C' } };
      sub.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

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

      const lastRow = Math.max(headerRowIdx, r - 1);
      const lastCol = colCount + 1;
      for (let rowNum = 1; rowNum <= lastRow; rowNum++) {
        const row = ws.getRow(rowNum);
        for (let col = 1; col <= lastCol; col++) {
          row.getCell(col).protection = { locked: true };
        }
      }

      // Hoja de solo lectura: se puede ver/seleccionar, no editar.
      await ws.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false,
      });

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
