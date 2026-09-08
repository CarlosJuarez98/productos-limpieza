import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
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
  @ViewChildren('denInput') denInputs!: QueryList<ElementRef<HTMLInputElement>>;

  caja: CajaResumen | null = null;
  error = '';
  ok = '';
  /** Billetes/monedas contados en caja. */
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
  guardandoPeriodo = false;
  mov = {
    fecha: this.hoyLocal(),
    tipo: 'RETIRO' as TipoMovimientoCaja,
    monto: null as number | null,
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

  /** Día del último corte; ese día ya no cuenta en el periodo. */
  get fechaUltimoCorte(): string {
    if (this.caja?.fechaUltimoCorte) return this.caja.fechaUltimoCorte;
    if (this.ultimoCorte) return this.ultimoCorte;
    const inicio = this.caja?.fechaInicio || this.config.fechaInicio;
    return inicio ? this.sumarDias(inicio, -1) : '';
  }

  /** Cortes de más reciente a más antiguo (BD). */
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
    if (Math.abs(x) < 0.005) return '';
    if (x < 0) return `Faltaron $${Math.abs(x).toFixed(2)}.`;
    return `Sobraron $${x.toFixed(2)}.`;
  }

  get bloquesMovimientos(): BloqueMov[] {
    const src = this.detalleCorte || this.caja;
    if (!src) return [];
    return [
      { titulo: 'Retiros', items: src.retiros || [], conMotivo: true },
      { titulo: 'Ingresos', items: src.ingresos || [], conMotivo: true },
    ];
  }

  /** Transferencias del banco: siempre globales (no por periodo/corte). */
  get transferenciasVista(): MovimientoCaja[] {
    return this.caja?.transferencias || [];
  }

  get retirosTransferenciaVista(): MovimientoCaja[] {
    return this.caja?.retirosTransferencia || [];
  }

  get saldoBanco(): number {
    return Number(this.caja?.totalTransferenciasNetas) || 0;
  }

  get totalTransferenciasVista(): number {
    return Number(this.caja?.totalTransferencias) || 0;
  }

  get totalRetirosTxVista(): number {
    return Number(this.caja?.totalRetirosTransferencia) || 0;
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

  /** Enter en una denominación → siguiente campo. */
  onDenEnter(ev: Event, index: number): void {
    ev.preventDefault();
    const siguiente = this.denInputs?.get(index + 1)?.nativeElement;
    if (!siguiente) return;
    siguiente.focus();
    siguiente.select();
  }

  /** Total de la calculadora de efectivo. */
  get totalCalculadora(): number {
    return Math.round(this.denominaciones.reduce((s, d) => s + this.totalLinea(d), 0) * 100) / 100;
  }

  /** Diferencia de caja = calculadora − total caja. */
  get diferenciaCaja(): number {
    if (!this.caja) return 0;
    return Math.round((this.totalCalculadora - Number(this.caja.totalCaja)) * 100) / 100;
  }

  get estadoDiferencia(): 'ok' | 'faltante' | 'sobrante' | null {
    if (!this.caja) return null;
    const d = this.diferenciaCaja;
    if (Math.abs(d) < 0.005) return 'ok';
    return d < 0 ? 'faltante' : 'sobrante';
  }

  /** Se puede cerrar si la fecha fin aún no es un corte y no es futura. */
  get puedeGuardarPeriodo(): boolean {
    if (this.guardandoPeriodo || !this.config.fechaFin || !this.config.fechaInicio) return false;
    if (this.config.fechaFin > this.hoyLocal()) return false;
    if (this.config.fechaFin < this.config.fechaInicio) return false;
    const cortes = this.caja?.fechasCorte || [];
    return !cortes.includes(this.config.fechaFin);
  }

  get etiquetaBotonPeriodo(): string {
    if (this.guardandoPeriodo) return 'Guardando…';
    if (!this.config.fechaFin) return 'Guardar periodo';
    const cortes = this.caja?.fechasCorte || [];
    if (cortes.includes(this.config.fechaFin)) return 'Periodo cerrado';
    if (this.config.fechaFin > this.hoyLocal()) return 'Fecha fin inválida';
    return 'Guardar periodo';
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

  async guardarConfig(): Promise<void> {
    if (!this.puedeGuardarPeriodo || !this.caja) return;
    this.error = '';
    this.ok = '';
    const hoy = this.hoyLocal();
    if (this.config.fechaFin && this.config.fechaFin > hoy) {
      this.error = 'La fecha fin no puede ser posterior a hoy';
      this.config.fechaFin = hoy;
      return;
    }

    const corte = this.config.fechaFin;
    const inicioNuevo = this.sumarDias(corte, 1);
    const contado = this.totalCalculadora;
    const esperado = Number(this.caja.totalCaja) || 0;
    const dif = Math.round((contado - esperado) * 100) / 100;
    let difTxt = 'sin contado en calculadora';
    if (contado > 0) {
      if (Math.abs(dif) < 0.005) difTxt = 'cuadró';
      else if (dif < 0) difTxt = `faltaron $${Math.abs(dif).toFixed(2)}`;
      else difTxt = `sobraron $${dif.toFixed(2)}`;
    }

    const resumen =
      `¿Guardar y cerrar el periodo hasta ${formatFechaDmY(corte)}?\n\n` +
      `Vendido: $${Number(this.caja.totalVendidoProductos).toFixed(2)}\n` +
      `Ingresos: $${Number(this.caja.totalIngresos).toFixed(2)}\n` +
      `Retiros: $${Number(this.caja.totalRetiros).toFixed(2)}\n` +
      `Total caja: $${esperado.toFixed(2)}\n` +
      `Contado: $${contado.toFixed(2)} (${difTxt})\n\n` +
      `Quedará registrado el corte. El periodo nuevo empieza el ${formatFechaDmY(inicioNuevo)} con fondo $200.`;

    const ok = await this.confirmDlg.ask(resumen, {
      titulo: 'Guardar periodo',
      confirmarTexto: 'Guardar',
    });
    if (!ok) return;

    if (contado <= 0) {
      const seguir = await this.confirmDlg.ask(
        'La calculadora está en $0. ¿Guardar el periodo sin contado? (no se sabrá si faltó o sobró)',
        { titulo: 'Sin contado', confirmarTexto: 'Guardar igual' }
      );
      if (!seguir) return;
    }

    this.guardandoPeriodo = true;
    this.api
      .marcarCorte({
        fechaCorte: corte,
        fondoInicial: 200,
        fondoPeriodo: Number(this.config.fondoInicial),
        totalCalculadora: contado > 0 ? contado : undefined,
      })
      .subscribe({
        next: () => {
          this.ok =
            `Periodo cerrado el ${formatFechaDmY(corte)}: retiros, ingresos, total caja y ${difTxt} quedaron guardados. ` +
            `Nuevo periodo desde ${formatFechaDmY(inicioNuevo)}.`;
          this.denominaciones.forEach((x) => (x.cantidad = null));
          this.guardandoPeriodo = false;
          this.limpiarCorteSeleccionado();
          this.cargar();
        },
        error: (e) => {
          this.guardandoPeriodo = false;
          this.error = e.error?.error || 'Error al guardar el periodo';
        },
      });
  }

  guardarMovimiento(): void {
    this.error = '';
    this.ok = '';
    const monto = Number(this.mov.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.error = 'Indica el monto del movimiento';
      return;
    }
    this.api
      .crearMovimientoCaja({
        fecha: this.mov.fecha,
        tipo: this.mov.tipo,
        monto,
        motivo: this.mov.motivo || null,
      })
      .subscribe({
        next: () => {
          const tipo = this.mov.tipo;
          this.ok =
            tipo === 'TRANSFERENCIA' || tipo === 'RETIRO_TRANSFERENCIA'
              ? 'Movimiento guardado. Revisa la sección de banco / transferencias.'
              : 'Movimiento guardado.';
          this.mov.monto = null;
          this.mov.motivo = '';
          this.limpiarCorteSeleccionado();
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar movimiento'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar movimiento?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarMovimientoCaja(id).subscribe({ next: () => this.cargar() });
  }
}
