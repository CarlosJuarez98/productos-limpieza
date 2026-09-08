import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ExcelJS from 'exceljs';
import { ApiService } from '../../api.service';
import { InventarioItem } from '../../modelos';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-precios.component.html',
  styleUrl: './lista-precios.component.scss',
})
export class ListaPreciosComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
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
    this.api.inventario().subscribe({ next: (i) => (this.items = i) });
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
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

      // Logo arriba a la izquierda
      try {
        const logoBuf = await this.cargarLogo();
        if (logoBuf) {
          const logoId = wb.addImage({
            buffer: logoBuf,
            extension: 'png',
          });
          ws.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 110, height: 110 },
          });
        }
      } catch {
        // Sin logo: sigue el export con texto
      }

      ws.getRow(1).height = 88;
      ws.mergeCells(1, 2, 1, Math.max(2, colCount));
      const titulo = ws.getCell(1, 2);
      titulo.value = this.marca;
      titulo.font = { bold: true, size: 18, color: { argb: 'FF163528' } };
      titulo.alignment = { vertical: 'middle', horizontal: 'left' };

      ws.mergeCells(2, 1, 2, colCount);
      const sub = ws.getCell(2, 1);
      sub.value = `Lista de precios · ${this.fechaLista}`;
      sub.font = { bold: true, size: 12, color: { argb: 'FF2D4A3C' } };
      sub.alignment = { vertical: 'middle' };

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
        row.getCell(2).value = this.comoPesos(item.precioVentaHoy);
        row.getCell(2).alignment = { horizontal: 'right' };
        let c = 3;
        if (this.cols.mayoreo5) {
          row.getCell(c).value = this.comoPesos(item.precioMayoreo5);
          row.getCell(c).alignment = { horizontal: 'right' };
          c++;
        }
        if (this.cols.mayoreo10) {
          row.getCell(c).value = this.comoPesos(item.precioMayoreo10);
          row.getCell(c).alignment = { horizontal: 'right' };
        }
        r++;
      }

      ws.getColumn(1).width = 36;
      for (let i = 2; i <= colCount; i++) {
        ws.getColumn(i).width = 14;
      }

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

  private comoPesos(valor: number | null | undefined): string {
    const n = Number(valor);
    const v = Number.isFinite(n) ? n : 0;
    return (
      '$' +
      v.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  private fechaListaLarga(): string {
    const d = new Date();
    return `${d.getDate()}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
  }
}
