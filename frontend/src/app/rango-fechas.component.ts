import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatFechaDmY } from './fecha-dmy.pipe';

type Celda = {
  iso: string;
  dia: number;
  fueraMes: boolean;
  disabled: boolean;
};

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'] as const;
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
] as const;

@Component({
  selector: 'app-rango-fechas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rango" [class.abierto]="abierto" [class.deshabilitado]="disabled">
      <button
        type="button"
        class="rango-trigger"
        [disabled]="disabled"
        [attr.aria-expanded]="abierto"
        [attr.aria-label]="ariaLabel"
        (click)="toggle($event)"
      >
        <span class="rango-texto">{{ textoRango }}</span>
        <span class="rango-ico" aria-hidden="true">▾</span>
      </button>

      @if (abierto) {
        <div class="rango-pop" role="dialog" [attr.aria-label]="ariaLabel" (click)="$event.stopPropagation()">
          <div class="rango-cab">
            <button type="button" class="nav" (click)="mesAnterior()" aria-label="Mes anterior">‹</button>
            <strong>{{ tituloMes }}</strong>
            <button type="button" class="nav" (click)="mesSiguiente()" aria-label="Mes siguiente">›</button>
          </div>
          <p class="rango-hint">{{ hintSeleccion }}</p>
          <div class="rango-grid dias-cab">
            @for (d of diasSemana; track d) {
              <span>{{ d }}</span>
            }
          </div>
          <div class="rango-grid">
            @for (c of celdas; track c.iso + (c.fueraMes ? '-o' : '')) {
              <button
                type="button"
                class="dia"
                [class.fuera]="c.fueraMes"
                [class.disabled]="c.disabled"
                [class.inicio]="esInicio(c.iso)"
                [class.fin]="esFin(c.iso)"
                [class.en-rango]="enRango(c.iso)"
                [class.hoy]="c.iso === hoy"
                [disabled]="c.disabled"
                (click)="elegir(c)"
              >
                {{ c.dia }}
              </button>
            }
          </div>
          <div class="rango-acc">
            <button type="button" class="secondary" (click)="cerrar()">Cerrar</button>
            @if (!bloquearDesde && (borradorDesde || borradorHasta)) {
              <button type="button" class="secondary" (click)="limpiar()">Limpiar</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .rango {
        position: relative;
        width: 100%;
      }
      .rango-trigger {
        width: 100%;
        height: 2.35rem;
        min-height: 2.35rem;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.45rem;
        padding: 0 0.7rem;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: #fff;
        color: var(--text);
        font: inherit;
        font-weight: 600;
        box-shadow: none;
        transform: none;
        cursor: pointer;
        text-align: left;
      }
      .rango-trigger:hover:not(:disabled) {
        background: var(--accent-soft);
        color: var(--text);
        box-shadow: none;
        transform: none;
      }
      .rango.deshabilitado .rango-trigger,
      .rango-trigger:disabled {
        background: color-mix(in srgb, var(--line) 18%, #fff);
        color: var(--muted);
        cursor: default;
        opacity: 1;
      }
      .rango-texto {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .rango-ico {
        flex: 0 0 auto;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .rango-pop {
        position: absolute;
        z-index: 40;
        top: calc(100% + 0.35rem);
        left: 0;
        width: min(19.5rem, 92vw);
        padding: 0.7rem;
        border: 1px solid var(--line);
        border-radius: 0.85rem;
        background: #fff;
        box-shadow: 0 14px 34px rgba(22, 40, 33, 0.14);
      }
      .rango-cab {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        margin-bottom: 0.35rem;
      }
      .rango-cab strong {
        font-size: 0.92rem;
      }
      .rango-cab .nav {
        width: 2.1rem;
        height: 2.1rem;
        min-width: 2.1rem;
        padding: 0;
        border-radius: 999px;
        font-size: 1.2rem;
        line-height: 1;
      }
      .rango-hint {
        margin: 0 0 0.45rem;
        font-size: 0.78rem;
        color: var(--muted);
        font-weight: 600;
      }
      .rango-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.15rem;
      }
      .dias-cab {
        margin-bottom: 0.2rem;
      }
      .dias-cab span {
        text-align: center;
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--muted);
        padding: 0.15rem 0;
      }
      .dia {
        aspect-ratio: 1;
        width: 100%;
        min-width: 0;
        min-height: 0;
        height: auto;
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 0.45rem;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        box-shadow: none;
        transform: none;
        cursor: pointer;
      }
      .dia:hover:not(:disabled):not(.disabled) {
        background: var(--accent-soft);
        color: var(--text);
        box-shadow: none;
        transform: none;
      }
      .dia.fuera {
        color: color-mix(in srgb, var(--muted) 55%, #fff);
      }
      .dia.hoy:not(.inicio):not(.fin) {
        box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, var(--line));
      }
      .dia.en-rango {
        background: color-mix(in srgb, var(--accent-soft) 80%, #fff);
        border-radius: 0;
      }
      .dia.inicio,
      .dia.fin {
        background: var(--accent);
        color: #fff;
      }
      .dia.inicio {
        border-radius: 0.45rem 0 0 0.45rem;
      }
      .dia.fin {
        border-radius: 0 0.45rem 0.45rem 0;
      }
      .dia.inicio.fin {
        border-radius: 0.45rem;
      }
      .dia.disabled,
      .dia:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .rango-acc {
        display: flex;
        justify-content: flex-end;
        gap: 0.35rem;
        margin-top: 0.55rem;
      }
      .rango-acc .secondary {
        min-height: 2.1rem;
        padding: 0.3rem 0.7rem;
        font-size: 0.82rem;
      }
      @media (max-width: 767px) {
        .rango-pop {
          width: min(22rem, calc(100vw - 1.5rem));
        }
      }
    `,
  ],
})
export class RangoFechasComponent {
  @Input() desde = '';
  @Input() hasta = '';
  @Input() disabled = false;
  /** Si true, no se puede cambiar el inicio (solo el fin), típico de corte de caja. */
  @Input() bloquearDesde = false;
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() ariaLabel = 'Rango de fechas';
  @Output() desdeChange = new EventEmitter<string>();
  @Output() hastaChange = new EventEmitter<string>();

  readonly diasSemana = DIAS;
  abierto = false;
  vistaAnio = 0;
  vistaMes = 0; // 0-11
  /** Selección en curso dentro del popup. */
  borradorDesde = '';
  borradorHasta = '';
  paso: 'desde' | 'hasta' = 'desde';
  hoy = '';

  constructor(private host: ElementRef<HTMLElement>) {
    this.hoy = this.isoHoy();
    const [y, m] = this.hoy.split('-').map(Number);
    this.vistaAnio = y;
    this.vistaMes = m - 1;
  }

  get textoRango(): string {
    const a = this.desde || this.borradorDesde;
    const b = this.hasta || this.borradorHasta;
    if (a && b) return `${formatFechaDmY(a)} → ${formatFechaDmY(b)}`;
    if (a) return `${formatFechaDmY(a)} → …`;
    return 'Elegir fechas';
  }

  get tituloMes(): string {
    return `${MESES[this.vistaMes]} ${this.vistaAnio}`;
  }

  get hintSeleccion(): string {
    if (this.bloquearDesde) return 'Elige la fecha fin en el calendario';
    if (this.paso === 'desde' || !this.borradorDesde) return 'Elige la fecha de inicio';
    return 'Elige la fecha de fin';
  }

  get celdas(): Celda[] {
    const first = new Date(this.vistaAnio, this.vistaMes, 1);
    // Lunes = 0 … Domingo = 6
    const weekday = (first.getDay() + 6) % 7;
    const start = new Date(this.vistaAnio, this.vistaMes, 1 - weekday);
    const out: Celda[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = this.isoDe(d);
      out.push({
        iso,
        dia: d.getDate(),
        fueraMes: d.getMonth() !== this.vistaMes,
        disabled: this.fechaBloqueada(iso),
      });
    }
    return out;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.abierto) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.abierto) this.cerrar();
  }

  toggle(ev?: Event): void {
    ev?.stopPropagation();
    if (this.disabled) return;
    if (this.abierto) {
      this.cerrar();
      return;
    }
    this.abrir();
  }

  abrir(): void {
    this.borradorDesde = this.desde || '';
    this.borradorHasta = this.hasta || '';
    this.paso = this.bloquearDesde ? 'hasta' : 'desde';
    const base = this.borradorHasta || this.borradorDesde || this.hoy;
    const [y, m] = base.split('-').map(Number);
    if (y && m) {
      this.vistaAnio = y;
      this.vistaMes = m - 1;
    }
    this.abierto = true;
  }

  cerrar(): void {
    this.abierto = false;
  }

  limpiar(): void {
    if (this.bloquearDesde) return;
    this.borradorDesde = '';
    this.borradorHasta = '';
    this.paso = 'desde';
    this.emitir('', '');
  }

  mesAnterior(): void {
    if (this.vistaMes === 0) {
      this.vistaMes = 11;
      this.vistaAnio -= 1;
    } else {
      this.vistaMes -= 1;
    }
  }

  mesSiguiente(): void {
    if (this.vistaMes === 11) {
      this.vistaMes = 0;
      this.vistaAnio += 1;
    } else {
      this.vistaMes += 1;
    }
  }

  elegir(c: Celda): void {
    if (c.disabled) return;
    if (this.bloquearDesde) {
      this.borradorHasta = c.iso;
      if (this.borradorDesde && c.iso < this.borradorDesde) return;
      this.emitir(this.borradorDesde || this.desde, c.iso);
      this.cerrar();
      return;
    }

    if (this.paso === 'desde' || !this.borradorDesde) {
      this.borradorDesde = c.iso;
      this.borradorHasta = '';
      this.paso = 'hasta';
      return;
    }

    let a = this.borradorDesde;
    let b = c.iso;
    if (b < a) {
      const t = a;
      a = b;
      b = t;
    }
    this.borradorDesde = a;
    this.borradorHasta = b;
    this.emitir(a, b);
    this.cerrar();
  }

  esInicio(iso: string): boolean {
    const a = this.borradorDesde || this.desde;
    return !!a && iso === a;
  }

  esFin(iso: string): boolean {
    const b = this.borradorHasta || this.hasta;
    return !!b && iso === b;
  }

  enRango(iso: string): boolean {
    const a = this.borradorDesde || this.desde;
    const b = this.borradorHasta || this.hasta;
    if (!a || !b) return false;
    return iso > a && iso < b;
  }

  private emitir(desde: string, hasta: string): void {
    if (desde !== this.desde) this.desdeChange.emit(desde);
    if (hasta !== this.hasta) this.hastaChange.emit(hasta);
  }

  private fechaBloqueada(iso: string): boolean {
    if (this.min && iso < this.min) return true;
    if (this.max && iso > this.max) return true;
    if (this.bloquearDesde && this.desde && iso < this.desde) return true;
    return false;
  }

  private isoHoy(): string {
    const n = new Date();
    return this.isoDe(n);
  }

  private isoDe(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
