import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InversionItem, InversionResumen } from '../../modelos';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { ClearableDirective } from '../../clearable.directive';
import { AutoHideDirective } from '../../auto-hide.directive';

@Component({
  selector: 'app-inversion',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginadorComponent, ClearableDirective, AutoHideDirective],
  templateUrl: './inversion.component.html',
  styleUrl: './inversion.component.scss',
})
export class InversionComponent implements OnInit {
  data: InversionResumen | null = null;
  productos: InversionItem[] = [];
  infraestructura: InversionItem[] = [];
  pagProductos = new PaginacionEstado<InversionItem>();
  pagInfra = new PaginacionEstado<InversionItem>();
  error = '';
  ok = '';
  editando: InversionItem | null = null;
  form = {
    tipo: 'INFRAESTRUCTURA' as 'PRODUCTO' | 'INFRAESTRUCTURA',
    concepto: '',
    cantidad: null as number | null,
    precioUnidad: null as number | null,
    monto: null as number | null,
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  private syncPaginadores(): void {
    this.productos = (this.data?.items ?? []).filter((i) => i.tipo === 'PRODUCTO');
    this.infraestructura = (this.data?.items ?? []).filter((i) => i.tipo === 'INFRAESTRUCTURA');
    this.pagProductos.setItems(this.productos, false);
    this.pagInfra.setItems(this.infraestructura, false);
  }

  get retornoPositivo(): boolean {
    return !!this.data?.inversionInicialRecuperada;
  }

  /** % de la inversión inicial ya cubierto por ventas (máx 100). */
  get pctRecuperado(): number {
    const inv = Number(this.data?.inversionInicial) || 0;
    const ventas = Number(this.data?.totalVentas) || 0;
    if (inv <= 0) return ventas > 0 ? 100 : 0;
    return Math.min(100, Math.round((ventas / inv) * 1000) / 10);
  }

  cargar(): void {
    this.api.inversion().subscribe({
      next: (d) => {
        this.data = d;
        this.syncPaginadores();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inversión'),
    });
  }

  onCantidadPrecioChange(): void {
    const c = Number(this.form.cantidad);
    const p = Number(this.form.precioUnidad);
    if (Number.isFinite(c) && c > 0 && Number.isFinite(p) && p >= 0) {
      this.form.monto = Math.round(c * p * 100) / 100;
    }
  }

  cancelar(): void {
    this.editando = null;
    this.form = {
      tipo: 'INFRAESTRUCTURA',
      concepto: '',
      cantidad: null,
      precioUnidad: null,
      monto: null,
    };
  }

  private numOrNull(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  guardarInfra(): void {
    this.error = '';
    this.ok = '';
    const concepto = (this.form.concepto || '').trim();
    if (!concepto) {
      this.error = 'Indica el concepto';
      return;
    }
    const monto = this.numOrNull(this.form.monto);
    if (monto == null || monto < 0) {
      this.error = 'Indica el monto';
      return;
    }
    this.api
      .crearInversion({
        tipo: 'INFRAESTRUCTURA',
        concepto,
        cantidad: null,
        precioUnidad: null,
        monto,
      })
      .subscribe({
        next: () => {
          this.ok = 'Infraestructura agregada';
          this.cancelar();
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar'),
      });
  }

  async eliminar(item: InversionItem): Promise<void> {
    const ok = await this.confirmDlg.ask(`¿Eliminar «${item.concepto}»?`, {
      titulo: 'Eliminar ítem',
      confirmarTexto: 'Eliminar',
    });
    if (!ok) return;
    this.api.eliminarInversion(item.id).subscribe({
      next: () => {
        if (this.editando?.id === item.id) this.cancelar();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo eliminar'),
    });
  }
}
