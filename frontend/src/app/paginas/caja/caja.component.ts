import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { CajaResumen, CortePeriodo, MovimientoCaja, TipoMovimientoCaja } from '../../modelos';
import { FechaDmYPipe, formatFechaDmY } from '../../fecha-dmy.pipe';

interface Denominacion {
  valor: number;
  cantidad: number | null;
}

interface BloqueMov {
  titulo: string;
  items: MovimientoCaja[];
  conMotivo: boolean;
}

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmYPipe],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss',
})
export class CajaComponent implements OnInit {
  caja: CajaResumen | null = null;
  error = '';
  ok = '';
  /** Como en Excel: billetes/monedas contados. */
  denominaciones: Denominacion[] = [
    { valor: 500, cantidad: null },
    { valor: 200, cantidad: null },
    { valor: 100, cantidad: null },
    { valor: 50, cantidad: null },
    { valor: 20, cantidad: null },
    { valor: 10, cantidad: null },
    { valor: 5, cantidad: null },
    { valor: 2, cantidad: null },
    { valor: 1, cantidad: null },
    { valor: 0.5, cantidad: null },
  ];
  /** Fecha del último corte marcado (la que se usa como inicio del periodo actual). */
  ultimoCorte = '';
  mostrarCortes = false;
  corteSeleccionado: string | null = null;
  detalleCorte: CortePeriodo | null = null;
  cargandoCorte = false;

  config = {
    fechaInicio: '',
    fechaFin: '',
    fondoInicial: 200,
  };
  mov = {
    fecha: this.hoyLocal(),
    tipo: 'RETIRO' as TipoMovimientoCaja,
    monto: 0,
    motivo: '',
  };

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

  /** Suma (o resta) días a una fecha yyyy-MM-dd en calendario local. */
  sumarDias(iso: string, dias: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /** Día del último corte (naranja Excel); ese día ya no cuenta en el periodo. */
  get fechaUltimoCorte(): string {
    if (this.caja?.fechaUltimoCorte) return this.caja.fechaUltimoCorte;
    if (this.ultimoCorte) return this.ultimoCorte;
    const inicio = this.caja?.fechaInicio || this.config.fechaInicio;
    return inicio ? this.sumarDias(inicio, -1) : '';
  }

  /** Cortes de más reciente a más antiguo (fechas naranjas Excel). */
  get cortesAnteriores(): string[] {
    const list = [...(this.caja?.fechasCorte || [])];
    return list.sort((a, b) => b.localeCompare(a));
  }

  consultarCorte(fecha: string): void {
    this.corteSeleccionado = fecha;
    this.mostrarCortes = true;
    this.cargandoCorte = true;
    this.detalleCorte = null;
    this.api.detalleCorte(fecha).subscribe({
      next: (d) => {
        this.detalleCorte = d;
        this.cargandoCorte = false;
      },
      error: (e) => {
        this.cargandoCorte = false;
        this.error = e.error?.error || 'No se pudo cargar el corte';
      },
    });
  }

  get mensajeDetalleCorte(): string {
    const d = this.detalleCorte;
    if (!d) return '';
    if (d.diferencia == null) {
      return 'Sin conteo de billetes guardado en este corte (solo totales del periodo).';
    }
    const x = Number(d.diferencia);
    if (Math.abs(x) < 0.005) return 'Cuadró: contado = total caja.';
    if (x < 0) return `Faltaron $${Math.abs(x).toFixed(2)}.`;
    return `Sobraron $${x.toFixed(2)}.`;
  }

  get bloquesMovimientos(): BloqueMov[] {
    const src = this.detalleCorte || this.caja;
    if (!src) return [];
    return [
      { titulo: 'Retiros', items: src.retiros || [], conMotivo: true },
      { titulo: 'Ingresos', items: src.ingresos || [], conMotivo: true },
      { titulo: 'Retiros transferencia', items: src.retirosTransferencia || [], conMotivo: false },
      { titulo: 'Transferencias', items: src.transferencias || [], conMotivo: false },
    ];
  }

  limpiarCorteSeleccionado(): void {
    this.corteSeleccionado = null;
    this.detalleCorte = null;
  }

  totalLinea(d: Denominacion): number {
    const c = Number(d.cantidad);
    if (!Number.isFinite(c) || c <= 0) return 0;
    return Math.round(d.valor * c * 100) / 100;
  }

  /** Excel: Total Calculadora */
  get totalCalculadora(): number {
    return Math.round(this.denominaciones.reduce((s, d) => s + this.totalLinea(d), 0) * 100) / 100;
  }

  /** Excel: Diferencia de caja = Calculadora − Total caja */
  get diferenciaCaja(): number {
    if (!this.caja) return 0;
    return Math.round((this.totalCalculadora - Number(this.caja.totalCaja)) * 100) / 100;
  }

  get mensajeDiferencia(): string {
    if (!this.caja || this.totalCalculadora <= 0) return '';
    const d = this.diferenciaCaja;
    const periodo =
      this.caja.fechaInicio && this.caja.fechaFin
        ? ` del periodo (${formatFechaDmY(this.caja.fechaInicio)} → ${formatFechaDmY(this.caja.fechaFin)})`
        : ' del periodo';
    if (Math.abs(d) < 0.005) {
      return `Cuadra: el efectivo contado coincide con las ventas y movimientos${periodo}.`;
    }
    if (d < 0) {
      return `Faltan $${Math.abs(d).toFixed(2)}: el contado es menor que el total caja${periodo}.`;
    }
    return `Sobran $${d.toFixed(2)} vs el total caja${periodo}.`;
  }

  get estadoDiferencia(): 'ok' | 'faltante' | 'sobrante' | null {
    if (!this.caja || this.totalCalculadora <= 0) return null;
    const d = this.diferenciaCaja;
    if (Math.abs(d) < 0.005) return 'ok';
    return d < 0 ? 'faltante' : 'sobrante';
  }

  cargar(): void {
    this.api.caja().subscribe({
      next: (c) => {
        this.caja = c;
        this.ultimoCorte = c.fechaUltimoCorte || (c.fechaInicio ? this.sumarDias(c.fechaInicio, -1) : '');
        this.config = {
          fechaInicio: c.fechaInicio ?? '',
          fechaFin: c.fechaFin ?? this.hoyLocal(),
          fondoInicial: c.fondoInicial,
        };
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar caja'),
    });
  }

  guardarConfig(): void {
    this.error = '';
    this.ok = '';
    this.api.actualizarCajaConfig(this.config).subscribe({
      next: () => {
        this.ok = 'Periodo guardado';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar configuración'),
    });
  }

  /** Marca la fecha fin como corte (naranja); el periodo nuevo empieza al día siguiente. */
  async marcarCorte(): Promise<void> {
    if (!this.config.fechaFin) {
      this.error = 'Indica la fecha fin del corte';
      return;
    }
    const corte = this.config.fechaFin;
    const inicio = this.sumarDias(corte, 1);
    const ok = await this.confirmDlg.ask(
      `¿Marcar corte el ${formatFechaDmY(corte)}? Quedará en naranja como en Excel. El periodo nuevo empieza el ${formatFechaDmY(inicio)} con fondo $200.`
    );
    if (!ok) return;
    const contado = this.totalCalculadora > 0 ? this.totalCalculadora : undefined;
    this.denominaciones.forEach((x) => (x.cantidad = null));
    this.error = '';
    this.ok = '';
    this.api.marcarCorte({
      fechaCorte: corte,
      fondoInicial: 200,
      totalCalculadora: contado,
    }).subscribe({
      next: () => {
        this.ok = `Corte marcado el ${formatFechaDmY(corte)}: el periodo cuenta desde ${formatFechaDmY(inicio)}`;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al marcar el corte'),
    });
  }

  /** Extiende el periodo: mantiene inicio (día después del corte), fin = hoy, fondo $200. */
  async iniciarNuevoPeriodo(): Promise<void> {
    const inicio = this.config.fechaInicio || this.sumarDias(this.config.fechaFin || this.hoyLocal(), 1);
    const ok = await this.confirmDlg.ask(
      `¿Continuar periodo desde ${formatFechaDmY(inicio)} (día siguiente al último corte) hasta hoy con fondo $200?`
    );
    if (!ok) return;
    this.config = {
      fechaInicio: inicio,
      fechaFin: this.hoyLocal(),
      fondoInicial: 200,
    };
    this.denominaciones.forEach((x) => (x.cantidad = null));
    this.guardarConfig();
  }

  guardarMovimiento(): void {
    this.api.crearMovimientoCaja(this.mov).subscribe({
      next: () => {
        this.mov.monto = 0;
        this.mov.motivo = '';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar movimiento'),
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar movimiento?');
    if (!ok) return;
    this.api.eliminarMovimientoCaja(id).subscribe({ next: () => this.cargar() });
  }
}
