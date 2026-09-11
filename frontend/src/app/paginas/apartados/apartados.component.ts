import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { ClearableDirective } from '../../clearable.directive';
import { AutoHideDirective } from '../../auto-hide.directive';

@Component({
  selector: 'app-apartados',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmYPipe, PaginadorComponent, ClearableDirective, AutoHideDirective],
  templateUrl: './apartados.component.html',
  styleUrl: './apartados.component.scss',
})
export class ApartadosComponent implements OnInit {
  data: ApartadosResumen | null = null;
  caja: CajaResumen | null = null;
  private pagMovs = new Map<string, PaginacionEstado<Apartado>>();
  error = '';
  ok = '';

  formIngreso = {
    fecha: this.hoyLocal(),
    categoria: 'PRODUCTOS' as CategoriaApartado,
    ingreso: null as number | null,
  };

  /** Fecha común para el lote de gastos. */
  fechaGasto = this.hoyLocal();

  private nextGastoKey = 1;
  gastos: {
    key: number;
    categoria: CategoriaApartado;
    ingreso: number | null;
    motivo: string;
  }[] = [this.nuevaGasto(), this.nuevaGasto(), this.nuevaGasto()];

  /** Montos a repartir (no porcentajes). */
  montos = {
    productos: null as number | null,
    casa: null as number | null,
    salarios: null as number | null,
  };

  readonly bloquesRegistros: { titulo: string; tipo: TipoMovimientoApartado }[] = [
    { titulo: 'Ganancias', tipo: 'INGRESO' },
    { titulo: 'Gastos', tipo: 'GASTO' },
  ];

  readonly categoriasRegistros: { key: CategoriaApartado; label: string }[] = [
    { key: 'PRODUCTOS', label: 'Productos' },
    { key: 'CASA', label: 'Casa' },
    { key: 'SALARIOS', label: 'Salarios' },
  ];

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
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
        this.syncPaginadores(true);
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar apartados'),
    });
  }

  /** Contado − fondo del último corte (lo que salió / debe salir a apartados). */
  get delCorteParaApartar(): number {
    const v = Number(this.caja?.paraApartarUltimoCorte);
    if (Number.isFinite(v)) return v;
    return Math.round((this.yaApartadoDelCorte + this.disponibleCaja) * 100) / 100;
  }

  /** Ya registrado como ingreso a apartados tras el último corte. */
  get yaApartadoDelCorte(): number {
    const v = Number(this.caja?.yaApartadoDesdeUltimoCorte);
    if (Number.isFinite(v)) return v;
    return 0;
  }

  /** Lo que aún falta por apartar del último corte. */
  get disponibleCaja(): number {
    const v = Number(this.caja?.disponibleParaApartar);
    if (Number.isFinite(v)) return v;
    return 0;
  }

  /** Saldo actual (ingresos − gastos). */
  saldo(cat: CategoriaApartado): number {
    return Number(this.data?.totales?.[cat] ?? 0);
  }

  /** Suma de la columna: ingresos o gastos de esa categoría (no el saldo). */
  totalColumna(cat: CategoriaApartado, tipo: TipoMovimientoApartado): number {
    if (tipo === 'INGRESO') {
      const v = Number(this.data?.ingresos?.[cat]);
      if (Number.isFinite(v)) return v;
    } else {
      const v = Number(this.data?.gastos?.[cat]);
      if (Number.isFinite(v)) return v;
    }
    return this.movimientosDe(cat, tipo).reduce((s, a) => s + (Number(a.ingreso) || 0), 0);
  }

  totalBloque(tipo: TipoMovimientoApartado): number {
    return (
      Math.round(
        this.categoriasRegistros.reduce((s, c) => s + this.totalColumna(c.key, tipo), 0) * 100
      ) / 100
    );
  }

  /** Altura relativa de barra (máximo del bloque = 100%). */
  alturaBarra(tipo: TipoMovimientoApartado, cat: CategoriaApartado): number {
    const v = this.totalColumna(cat, tipo);
    if (v <= 0) return 0;
    const max = Math.max(
      ...this.categoriasRegistros.map((c) => this.totalColumna(c.key, tipo)),
      0
    );
    if (max <= 0) return 0;
    return Math.max(4, Math.round((v / max) * 100));
  }

  get totalSubapartados(): number {
    return this.saldo('PRODUCTOS') + this.saldo('CASA') + this.saldo('SALARIOS');
  }

  movimientosDe(cat: CategoriaApartado, tipo: TipoMovimientoApartado): Apartado[] {
    return (this.data?.movimientos ?? [])
      .filter((a) => a.categoria === cat && a.tipo === tipo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  private pagKey(cat: CategoriaApartado, tipo: TipoMovimientoApartado): string {
    return `${tipo}-${cat}`;
  }

  private syncPaginadores(reset = false): void {
    for (const bloque of this.bloquesRegistros) {
      for (const cat of this.categoriasRegistros) {
        const key = this.pagKey(cat.key, bloque.tipo);
        if (!this.pagMovs.has(key)) {
          this.pagMovs.set(key, new PaginacionEstado<Apartado>());
        }
        this.pagMovs.get(key)!.setItems(this.movimientosDe(cat.key, bloque.tipo), reset);
      }
    }
  }

  pagMov(cat: CategoriaApartado, tipo: TipoMovimientoApartado): PaginacionEstado<Apartado> {
    const key = this.pagKey(cat, tipo);
    if (!this.pagMovs.has(key)) {
      const pag = new PaginacionEstado<Apartado>();
      pag.setItems(this.movimientosDe(cat, tipo));
      this.pagMovs.set(key, pag);
    }
    return this.pagMovs.get(key)!;
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

  /** Lo que aún se puede repartir (disponible − lo capturado). */
  get restanteApartar(): number {
    return Math.round(Math.max(0, this.disponibleCaja - this.totalApartar) * 100) / 100;
  }

  get cabeEnCaja(): boolean {
    return this.totalApartar <= this.disponibleCaja + 0.001;
  }

  get puedeRegistrarReparto(): boolean {
    return this.totalApartar > 0 && this.cabeEnCaja;
  }

  /** Recorta el campo si el total supera lo disponible y corrige el input. */
  onMontoInput(campo: 'productos' | 'casa' | 'salarios', ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const raw = el.value;
    if (raw === '' || raw == null) {
      this.montos[campo] = null;
      return;
    }
    const limpio = Number(String(raw).replace(/,/g, '').trim());
    if (!Number.isFinite(limpio)) {
      return;
    }
    if (limpio <= 0) {
      this.montos[campo] = limpio === 0 ? 0 : null;
      el.value = limpio === 0 ? '0' : '';
      return;
    }
    const otros =
      (campo === 'productos' ? 0 : this.montoDe('productos')) +
      (campo === 'casa' ? 0 : this.montoDe('casa')) +
      (campo === 'salarios' ? 0 : this.montoDe('salarios'));
    const maxCampo = Math.round(Math.max(0, this.disponibleCaja - otros) * 100) / 100;
    const valor = Math.round(Math.min(limpio, maxCampo) * 100) / 100;
    this.montos[campo] = valor;
    // Forzar el tope en el input (ngModel no siempre refleja el clamp al teclear).
    if (valor !== limpio || el.value !== String(valor)) {
      el.value = String(valor);
    }
    this.cdr.detectChanges();
  }

  guardarGastos(): void {
    this.error = '';
    this.ok = '';
    const fecha = this.fechaGasto || this.hoyLocal();
    if (fecha > this.hoyLocal()) {
      this.error = 'La fecha del gasto no puede ser posterior a hoy';
      this.fechaGasto = this.hoyLocal();
      return;
    }

    const incompletas = this.gastos.filter((g) => {
      const monto = Number(g.ingreso);
      const tieneMonto = Number.isFinite(monto) && monto > 0;
      const tieneMotivo = !!g.motivo?.trim();
      return (tieneMonto && !tieneMotivo) || (!tieneMonto && tieneMotivo);
    });
    if (incompletas.length) {
      this.error = 'Completa monto y motivo en cada fila usada (o déjala vacía)';
      return;
    }

    const lineas = this.gastos.filter((g) => {
      const monto = Number(g.ingreso);
      return Number.isFinite(monto) && monto > 0 && !!g.motivo?.trim();
    });
    if (!lineas.length) {
      this.error = 'Indica al menos un gasto';
      return;
    }

    // Validar que no se gaste más del saldo por subapartado (sumando el lote).
    const uso: Record<string, number> = { PRODUCTOS: 0, CASA: 0, SALARIOS: 0 };
    for (const g of lineas) {
      uso[g.categoria] = (uso[g.categoria] || 0) + Number(g.ingreso);
    }
    for (const cat of ['PRODUCTOS', 'CASA', 'SALARIOS'] as CategoriaApartado[]) {
      const ped = Math.round((uso[cat] || 0) * 100) / 100;
      if (ped <= 0) continue;
      const disponible = this.saldo(cat);
      if (ped > disponible + 0.001) {
        this.error = `En ${cat.toLowerCase()} solo hay $${disponible.toFixed(2)}; intentas gastar $${ped.toFixed(2)}`;
        return;
      }
    }

    const requests = lineas.map((g) =>
      this.api.crearApartado({
        fecha,
        categoria: g.categoria,
        ingreso: Number(g.ingreso),
        tipo: 'GASTO' as TipoMovimientoApartado,
        motivo: g.motivo.trim(),
      })
    );

    forkJoin(requests).subscribe({
      next: () => {
        const total = Math.round(lineas.reduce((s, g) => s + Number(g.ingreso), 0) * 100) / 100;
        this.ok = `Se registraron ${lineas.length} gasto(s) por $${total.toFixed(2)}`;
        this.gastos = [this.nuevaGasto(), this.nuevaGasto(), this.nuevaGasto()];
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar gastos'),
    });
  }

  nuevaGasto(): {
    key: number;
    categoria: CategoriaApartado;
    ingreso: number | null;
    motivo: string;
  } {
    return {
      key: this.nextGastoKey++,
      categoria: 'PRODUCTOS',
      ingreso: null,
      motivo: '',
    };
  }

  agregarGasto(): void {
    this.gastos.push(this.nuevaGasto());
  }

  quitarGasto(index: number): void {
    if (this.gastos.length <= 1) {
      this.gastos = [this.nuevaGasto()];
      return;
    }
    this.gastos.splice(index, 1);
  }

  get totalGastosForm(): number {
    return (
      Math.round(
        this.gastos.reduce((s, g) => {
          const n = Number(g.ingreso);
          return s + (Number.isFinite(n) && n > 0 ? n : 0);
        }, 0) * 100
      ) / 100
    );
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
    const ok = await this.confirmDlg.ask('¿Eliminar movimiento de apartado?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarApartado(id).subscribe({ next: () => this.cargar() });
  }
}
