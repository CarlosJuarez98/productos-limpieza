import {
  ApplicationRef,
  Component,
  ElementRef,
  EmbeddedViewRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatFechaDmY } from './fecha-dmy.pipe';
import {
  ajustarVistaAMesPermitido,
  desplazarMes,
  mesTieneDiaPermitido,
} from './calendario-limites.util';
import { capturaTieneFocoEnCampo } from './paginacion.util';

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

/** Selector de un solo día (reemplazo de input type=date). Popup en document.body. */
@Component({
  selector: 'app-fecha-dia',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FechaDiaComponent),
      multi: true,
    },
  ],
  template: `
    <div class="fecha-dia" [class.abierto]="abierto" [class.deshabilitado]="isDisabled">
      <button
        type="button"
        class="fecha-trigger"
        [disabled]="isDisabled"
        [attr.aria-expanded]="abierto"
        [attr.aria-label]="ariaLabel"
        (click)="toggle($event)"
        (keydown.enter)="onTriggerEnter($event)"
      >
        <span class="fecha-texto">{{ texto }}</span>
        <span class="fecha-ico" aria-hidden="true">▾</span>
      </button>
    </div>

    <ng-template #popTpl>
      <div
        class="cal-pop"
        role="dialog"
        [attr.aria-label]="ariaLabel"
        [ngStyle]="popStyle"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
        (wheel)="$event.stopPropagation()"
      >
        <div class="cal-cab">
          <button
            type="button"
            class="cal-nav"
            (click)="mesAnterior()"
            [disabled]="!puedeMesAnterior"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <strong class="cal-mes">{{ tituloMes }}</strong>
          <button
            type="button"
            class="cal-nav"
            (click)="mesSiguiente()"
            [disabled]="!puedeMesSiguiente"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
        <div class="cal-grid dias-cab">
          @for (d of diasSemana; track d) {
            <span>{{ d }}</span>
          }
        </div>
        <div class="cal-grid">
          @for (c of celdas; track c.iso) {
            @if (c.fueraMes) {
              <span class="cal-dia cal-vacio" aria-hidden="true"></span>
            } @else {
              <button
                type="button"
                class="cal-dia"
                [class.disabled]="c.disabled"
                [class.inicio]="c.iso === valor"
                [class.fin]="c.iso === valor"
                [class.hoy]="c.iso === hoy"
                [disabled]="c.disabled"
                (click)="elegir(c)"
              >
                {{ c.dia }}
              </button>
            }
          }
        </div>
        <div class="cal-acc">
          <button type="button" class="secondary cal-btn" (click)="cerrar()">Cerrar</button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .fecha-dia {
        width: 100%;
      }
      .fecha-trigger {
        width: 100%;
        height: 2.35rem;
        min-height: 2.35rem;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.45rem;
        padding: 0 0.7rem;
        border: 1px solid var(--line);
        border-radius: var(--radius, 0.75rem);
        background: #fff;
        color: var(--text);
        font: inherit;
        font-weight: 600;
        box-shadow: none;
        transform: none;
        cursor: pointer;
        text-align: left;
      }
      .fecha-trigger:hover:not(:disabled) {
        background: var(--accent-soft);
        color: var(--text);
        box-shadow: none;
        transform: none;
      }
      .fecha-dia.deshabilitado .fecha-trigger,
      .fecha-trigger:disabled {
        background: color-mix(in srgb, var(--line) 18%, #fff);
        color: var(--muted);
        cursor: default;
        opacity: 1;
      }
      .fecha-texto {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .fecha-ico {
        flex: 0 0 auto;
        color: var(--muted);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class FechaDiaComponent implements OnDestroy, ControlValueAccessor {
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() ariaLabel = 'Fecha';
  @Input() required = false;
  @Output() valorChange = new EventEmitter<string>();
  /** Compat con (ngModelChange) vía CVA; también emite al elegir. */
  @Output() fechaEnter = new EventEmitter<void>();

  @ViewChild('popTpl') popTpl!: TemplateRef<void>;

  readonly diasSemana = DIAS;
  valor = '';
  abierto = false;
  isDisabled = false;
  vistaAnio = 0;
  vistaMes = 0;
  hoy = '';
  popStyle: Record<string, string> = {};

  private embedded?: EmbeddedViewRef<void>;
  private escuchandoScroll = false;
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly onScrollCapture = (): void => {
    if (this.abierto) this.ngZone.run(() => this.cerrar());
  };

  constructor(
    private host: ElementRef<HTMLElement>,
    private appRef: ApplicationRef,
    private ngZone: NgZone
  ) {
    this.hoy = this.isoHoy();
    const [y, m] = this.hoy.split('-').map(Number);
    this.vistaAnio = y;
    this.vistaMes = m - 1;
  }

  ngOnDestroy(): void {
    this.cerrar();
  }

  writeValue(v: string | null): void {
    this.valor = v || '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  get texto(): string {
    return this.valor ? formatFechaDmY(this.valor) : 'Elegir fecha';
  }

  get tituloMes(): string {
    return `${MESES[this.vistaMes]} ${this.vistaAnio}`;
  }

  get puedeMesAnterior(): boolean {
    const p = desplazarMes(this.vistaAnio, this.vistaMes, -1);
    return mesTieneDiaPermitido(p.anio, p.mes, (iso) => this.fechaBloqueada(iso));
  }

  get puedeMesSiguiente(): boolean {
    const p = desplazarMes(this.vistaAnio, this.vistaMes, 1);
    return mesTieneDiaPermitido(p.anio, p.mes, (iso) => this.fechaBloqueada(iso));
  }

  get celdas(): Celda[] {
    const first = new Date(this.vistaAnio, this.vistaMes, 1);
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
    const t = ev.target as Node;
    if (this.host.nativeElement.contains(t)) return;
    if (this.embedded?.rootNodes.some((n) => n instanceof Node && n.contains(t))) return;
    this.cerrar();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.abierto) this.cerrar();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (capturaTieneFocoEnCampo()) return;
    if (this.abierto) this.reposicionar();
  }

  onTriggerEnter(ev: Event): void {
    ev.preventDefault();
    this.fechaEnter.emit();
  }

  toggle(ev?: Event): void {
    ev?.stopPropagation();
    if (this.isDisabled) return;
    if (this.abierto) {
      this.cerrar();
      return;
    }
    this.abrir();
  }

  abrir(): void {
    const base = this.valor || this.hoy;
    const [y, m] = base.split('-').map(Number);
    if (y && m) {
      this.vistaAnio = y;
      this.vistaMes = m - 1;
    }
    const vista = ajustarVistaAMesPermitido(
      this.vistaAnio,
      this.vistaMes,
      (iso) => this.fechaBloqueada(iso),
      this.valor || this.max || this.hoy
    );
    this.vistaAnio = vista.anio;
    this.vistaMes = vista.mes;
    this.abierto = true;
    this.montarPop();
    this.ponerScrollListener();
    requestAnimationFrame(() => {
      this.reposicionar();
      this.embedded?.detectChanges();
    });
  }

  cerrar(): void {
    this.abierto = false;
    this.popStyle = {};
    this.desmontarPop();
    this.quitarScrollListener();
    this.onTouched();
  }

  mesAnterior(): void {
    if (!this.puedeMesAnterior) return;
    const p = desplazarMes(this.vistaAnio, this.vistaMes, -1);
    this.vistaAnio = p.anio;
    this.vistaMes = p.mes;
    this.embedded?.detectChanges();
  }

  mesSiguiente(): void {
    if (!this.puedeMesSiguiente) return;
    const p = desplazarMes(this.vistaAnio, this.vistaMes, 1);
    this.vistaAnio = p.anio;
    this.vistaMes = p.mes;
    this.embedded?.detectChanges();
  }

  elegir(c: Celda): void {
    if (c.disabled) return;
    this.valor = c.iso;
    this.onChange(c.iso);
    this.valorChange.emit(c.iso);
    this.cerrar();
  }

  private montarPop(): void {
    this.desmontarPop();
    if (!this.popTpl) return;
    this.embedded = this.popTpl.createEmbeddedView(undefined as void);
    this.appRef.attachView(this.embedded);
    for (const node of this.embedded.rootNodes) {
      if (node instanceof HTMLElement) document.body.appendChild(node);
    }
    this.embedded.detectChanges();
  }

  private desmontarPop(): void {
    if (!this.embedded) return;
    this.appRef.detachView(this.embedded);
    this.embedded.destroy();
    this.embedded = undefined;
  }

  private reposicionar(): void {
    const trigger = this.host.nativeElement.querySelector('.fecha-trigger') as HTMLElement | null;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(19.5 * 16, window.innerWidth - 24);
    let left = r.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    if (left < 12) left = 12;

    const popH = 20 * 16;
    let top = r.bottom + gap;
    if (top + Math.min(popH, 340) > window.innerHeight - 12) {
      const arriba = r.top - gap - Math.min(popH, 340);
      if (arriba >= 12) top = arriba;
      else top = Math.max(12, window.innerHeight - Math.min(popH, 340) - 12);
    }

    this.popStyle = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      zIndex: '10050',
    };
    this.embedded?.detectChanges();
  }

  private ponerScrollListener(): void {
    if (this.escuchandoScroll) return;
    document.addEventListener('scroll', this.onScrollCapture, true);
    this.escuchandoScroll = true;
  }

  private quitarScrollListener(): void {
    if (!this.escuchandoScroll) return;
    document.removeEventListener('scroll', this.onScrollCapture, true);
    this.escuchandoScroll = false;
  }

  private fechaBloqueada(iso: string): boolean {
    if (this.min && iso < this.min) return true;
    if (this.max && iso > this.max) return true;
    return false;
  }

  private isoHoy(): string {
    return this.isoDe(new Date());
  }

  private isoDe(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
