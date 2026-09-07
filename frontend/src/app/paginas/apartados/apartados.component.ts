import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import {
  Apartado,
  ApartadosResumen,
  CajaResumen,
  CategoriaApartado,
  TipoMovimientoApartado,
} from '../../modelos';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

@Component({
  selector: 'app-apartados',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmYPipe],
  templateUrl: './apartados.component.html',
  styleUrl: './apartados.component.scss',
})
export class ApartadosComponent implements OnInit {
  data: ApartadosResumen | null = null;
  caja: CajaResumen | null = null;
  error = '';
  ok = '';

  formIngreso = {
    fecha: this.hoyLocal(),
    categoria: 'PRODUCTOS' as CategoriaApartado,
    ingreso: 0,
  };

  formGasto = {
    fecha: this.hoyLocal(),
    categoria: 'PRODUCTOS' as CategoriaApartado,
    ingreso: 0,
    motivo: '',
  };

  /** Montos a repartir (no porcentajes). */
  montos = {
    productos: null as number | null,
    casa: null as number | null,
    salarios: null as number | null,
  };

  readonly columnasRegistros: {
    titulo: string;
    categoria: CategoriaApartado;
    tipo: TipoMovimientoApartado;
  }[] = [
    { titulo: 'Ganancia productos', categoria: 'PRODUCTOS', tipo: 'INGRESO' },
    { titulo: 'Ganancia casa', categoria: 'CASA', tipo: 'INGRESO' },
    { titulo: 'Ganancia salarios', categoria: 'SALARIOS', tipo: 'INGRESO' },
    { titulo: 'Gastos productos', categoria: 'PRODUCTOS', tipo: 'GASTO' },
    { titulo: 'Gastos casa', categoria: 'CASA', tipo: 'GASTO' },
    { titulo: 'Gastos salarios', categoria: 'SALARIOS', tipo: 'GASTO' },
  ];

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  cargar(): void {
    forkJoin({
      apartados: this.api.apartados(),
      caja: this.api.caja(),
    }).subscribe({
      next: ({ apartados, caja }) => {
        this.data = apartados;
        this.caja = caja;
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar apartados'),
    });
  }

  /** Dinero real disponible en caja (total negocio). */
  get disponibleCaja(): number {
    return Number(this.caja?.totalNegocio ?? this.caja?.totalCaja ?? 0);
  }

  /** Saldo actual (ingresos − gastos). */
  saldo(cat: CategoriaApartado): number {
    return Number(this.data?.totales?.[cat] ?? 0);
  }

  get totalSubapartados(): number {
    return this.saldo('PRODUCTOS') + this.saldo('CASA') + this.saldo('SALARIOS');
  }

  movimientosDe(cat: CategoriaApartado, tipo: TipoMovimientoApartado): Apartado[] {
    return (this.data?.movimientos ?? [])
      .filter((a) => a.categoria === cat && a.tipo === tipo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  montoDe(cat: 'productos' | 'casa' | 'salarios'): number {
    return Math.max(0, Number(this.montos[cat]) || 0);
  }

  get totalApartar(): number {
    return (
      Math.round(
        (this.montoDe('productos') + this.montoDe('casa') + this.montoDe('salarios')) * 100
      ) / 100
    );
  }

  get cabeEnCaja(): boolean {
    return this.totalApartar <= this.disponibleCaja + 0.001;
  }

  get puedeRegistrarReparto(): boolean {
    return this.totalApartar > 0 && this.cabeEnCaja;
  }

  guardarGasto(): void {
    this.error = '';
    this.ok = '';
    if (!this.formGasto.motivo?.trim()) {
      this.error = 'Indica el motivo del gasto';
      return;
    }
    this.api
      .crearApartado({
        fecha: this.formGasto.fecha,
        categoria: this.formGasto.categoria,
        ingreso: this.formGasto.ingreso,
        tipo: 'GASTO' as TipoMovimientoApartado,
        motivo: this.formGasto.motivo.trim(),
      })
      .subscribe({
        next: () => {
          this.formGasto.ingreso = 0;
          this.formGasto.motivo = '';
          this.ok = 'Gasto registrado (se restó del subapartado)';
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar gasto'),
      });
  }

  registrarReparto(): void {
    this.error = '';
    this.ok = '';
    const prod = this.montoDe('productos');
    const casa = this.montoDe('casa');
    const sal = this.montoDe('salarios');
    const total = this.totalApartar;

    if (total <= 0) {
      this.error = 'Indica al menos un monto a apartar';
      return;
    }
    if (total > this.disponibleCaja + 0.001) {
      this.error = `No puedes apartar $${total.toFixed(2)}: en caja solo hay $${this.disponibleCaja.toFixed(2)}`;
      return;
    }

    const fecha = this.formIngreso.fecha || this.hoyLocal();
    if (fecha > this.hoyLocal()) {
      this.error = 'La fecha de apartar no puede ser posterior a hoy';
      this.formIngreso.fecha = this.hoyLocal();
      return;
    }
    const requests = [];
    if (prod > 0) {
      requests.push(
        this.api.crearApartado({
          fecha,
          categoria: 'PRODUCTOS',
          ingreso: prod,
          tipo: 'INGRESO',
          motivo: null,
        })
      );
    }
    if (casa > 0) {
      requests.push(
        this.api.crearApartado({
          fecha,
          categoria: 'CASA',
          ingreso: casa,
          tipo: 'INGRESO',
          motivo: null,
        })
      );
    }
    if (sal > 0) {
      requests.push(
        this.api.crearApartado({
          fecha,
          categoria: 'SALARIOS',
          ingreso: sal,
          tipo: 'INGRESO',
          motivo: null,
        })
      );
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.ok = `Se apartaron $${total.toFixed(2)} de la caja`;
        this.montos = { productos: null, casa: null, salarios: null };
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al registrar el reparto'),
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar movimiento de apartado?');
    if (!ok) return;
    this.api.eliminarApartado(id).subscribe({ next: () => this.cargar() });
  }
}
