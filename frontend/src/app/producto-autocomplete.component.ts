import {
  ApplicationRef,
  Component,
  ElementRef,
  EmbeddedViewRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioItem } from './modelos';

/**
 * Autocomplete de producto.
 * La lista se monta en document.body (portal) para que position:fixed
 * no se rompa por transform de .linea-card / fade-up / overflow de main.
 */
@Component({
  selector: 'app-producto-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    '[class.lista-abierta]': 'listaVisible',
  },
  template: `
    <div
      class="producto-ac"
      [class.abierto]="listaVisible"
      #root
      (click)="$event.stopPropagation()"
    >
      <input
        #inputEl
        type="text"
        [ngModel]="texto"
        (ngModelChange)="onTexto($event)"
        (focus)="abrir()"
        (blur)="onBlur()"
        (keydown)="onKeydown($event)"
        role="combobox"
        [attr.aria-expanded]="listaVisible"
        aria-autocomplete="list"
        [placeholder]="placeholder"
        [required]="required"
        [disabled]="disabled"
        [readonly]="disabled"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        data-lpignore="true"
        data-1p-ignore="true"
        [attr.name]="inputNameSafe"
        [class.con-clear]="texto.trim() && !disabled"
      />
      @if (texto.trim() && !disabled) {
        <button
          type="button"
          class="ac-clear"
          aria-label="Borrar"
          tabindex="-1"
          (pointerdown)="limpiar($event)"
        >×</button>
      }
    </div>

    <ng-template #listaTpl>
      <ul
        class="producto-ac-sugerencias"
        [class.arriba]="abreArriba"
        [ngStyle]="estiloLista"
        role="listbox"
        (pointerdown)="$event.preventDefault()"
      >
        @for (p of filtrados; track p.id; let i = $index) {
          <li
            role="option"
            [class.activo]="i === indiceActivo"
            [attr.aria-selected]="i === indiceActivo"
            (pointerdown)="elegir(p); $event.preventDefault()"
            (mouseenter)="indiceActivo = i"
          >
            {{ p.nombre }}
            @if (mostrarExtra === 'stock') {
              <span class="extra">stock {{ p.stockActual | number: '1.0-2' }}</span>
            }
            @if (mostrarExtra === 'compra') {
              <span class="extra">compra \${{ p.precioCompra | number: '1.2-2' }}</span>
            }
          </li>
        } @empty {
          <li class="vacio">Sin coincidencia en inventario</li>
        }
      </ul>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        position: relative;
        z-index: 0;
      }
      :host.lista-abierta {
        z-index: 45;
      }
      .producto-ac {
        position: relative;
        z-index: 0;
        display: block;
        width: 100%;
        min-width: 0;
      }
      .producto-ac.abierto {
        z-index: 45;
      }
      .producto-ac input {
        width: 100%;
      }
      .producto-ac input.con-clear {
        padding-right: 2.25rem;
      }
      .ac-clear {
        position: absolute;
        right: 0.15rem;
        top: 50%;
        transform: translateY(-50%);
        width: 2rem;
        height: 2rem;
        min-width: 2rem;
        min-height: 2rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--muted);
        font-size: 1.35rem;
        font-weight: 700;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        -webkit-tap-highlight-color: transparent;
      }
      .ac-clear:hover,
      .ac-clear:active {
        color: var(--text);
        background: rgba(26, 43, 35, 0.1);
      }
      @media (max-width: 767px) {
        .producto-ac input {
          min-height: 2.5rem;
        }
      }
    `,
  ],
})
export class ProductoAutocompleteComponent implements OnChanges, OnDestroy {
  @Input() productos: InventarioItem[] = [];
  @Input() productoId: number | null = null;
  @Input() required = false;
  @Input() disabled = false;
  @Input() placeholder = 'Escribe el producto...';
  @Input() inputName = 'productoTexto';
  @Input() mostrarExtra: 'ninguno' | 'stock' | 'compra' = 'ninguno';
  @Input() enterAvanza = false;
  @Output() productoIdChange = new EventEmitter<number | null>();
  @Output() enterConfirmado = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('root') rootEl?: ElementRef<HTMLElement>;
  @ViewChild('listaTpl', { static: true }) listaTpl?: TemplateRef<unknown>;

  texto = '';
  abierto = false;
  abreArriba = false;
  estiloLista: Record<string, string> | null = null;
  indiceActivo = -1;

  private bloqueoReabrir = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollBound = false;
  private vvBound = false;
  private layoutObs: ResizeObserver | null = null;
  private ignorarScrollHasta = 0;
  private posRaf: number | null = null;
  private portalView: EmbeddedViewRef<unknown> | null = null;
  private readonly nameNonce = Math.random().toString(36).slice(2, 8);
  private stickTimers: ReturnType<typeof setTimeout>[] = [];
  private vistaAsegurada = false;

  private readonly onScrollCapture = (ev: Event): void => {
    if (!this.listaVisible) return;
    const t = ev.target;
    if (t instanceof Element && t.closest('.producto-ac-sugerencias')) return;
    if (Date.now() < this.ignorarScrollHasta) {
      this.programarReposicion();
      return;
    }
    if (this.inputFueraDeVista()) {
      this.cerrarLista(true);
      return;
    }
    this.programarReposicion();
  };

  private readonly onVisualViewport = (): void => {
    if (this.listaVisible) this.programarReposicion();
  };

  get listaVisible(): boolean {
    return this.abierto && !!this.texto.trim() && !this.productoExactoSeleccionado();
  }

  /** Name aleatorio: evita sugerencias nativas del browser (Room/Rome…). */
  get inputNameSafe(): string {
    return `pac-${this.nameNonce}-${this.inputName || 'q'}`;
  }

  constructor(private appRef: ApplicationRef) {}

  ngOnDestroy(): void {
    this.destruirPortal();
    this.desligarScroll();
    this.limpiarStickTimers();
    if (this.posRaf != null) cancelAnimationFrame(this.posRaf);
    if (this.blurTimer != null) clearTimeout(this.blurTimer);
  }

  focus(): void {
    this.inputEl?.nativeElement?.focus({ preventScroll: true });
  }

  estaVisible(): boolean {
    const el = this.inputEl?.nativeElement;
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  blur(): void {
    this.inputEl?.nativeElement?.blur();
  }

  limpiar(ev: Event): void {
    ev.preventDefault();
    this.bloqueoReabrir = false;
    this.texto = '';
    this.productoId = null;
    this.productoIdChange.emit(null);
    this.cerrarLista(false);
    this.focus();
  }

  onKeydown(ev: KeyboardEvent): void {
    const list = this.filtrados;
    if (ev.key === 'ArrowDown') {
      if (!this.texto.trim()) return;
      ev.preventDefault();
      this.abrir(true);
      if (list.length === 0) return;
      this.indiceActivo = this.indiceActivo < list.length - 1 ? this.indiceActivo + 1 : 0;
      this.scrollActivo();
      return;
    }
    if (ev.key === 'ArrowUp') {
      if (!this.listaVisible || list.length === 0) return;
      ev.preventDefault();
      this.indiceActivo = this.indiceActivo > 0 ? this.indiceActivo - 1 : list.length - 1;
      this.scrollActivo();
      return;
    }
    if (ev.key === 'Escape') {
      if (!this.abierto) return;
      ev.preventDefault();
      this.cerrarLista(false);
      return;
    }
    if (ev.key === 'Enter') {
      this.onEnter(ev);
    }
  }

  onEnter(ev: Event): void {
    const ke = ev as KeyboardEvent;
    if (this.listaVisible && this.filtrados.length > 0) {
      ke.preventDefault();
      const idx = this.indiceActivo >= 0 ? this.indiceActivo : 0;
      this.elegir(this.filtrados[idx]);
      return;
    }
    if (this.enterAvanza || this.productoId != null || this.texto.trim()) {
      ke.preventDefault();
      this.cerrarLista(true);
      this.enterConfirmado.emit();
    }
  }

  get filtrados(): InventarioItem[] {
    const q = this.texto.trim().toLowerCase();
    if (!q) return [];
    return this.productos
      .filter((p) => p.nombre.toLowerCase().includes(q))
      .slice(0, 20);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productoId'] || changes['productos']) {
      this.sincronizarDesdeId();
    }
  }

  abrir(forzar = false): void {
    if (this.disabled) return;
    if (this.bloqueoReabrir) {
      this.bloqueoReabrir = false;
      return;
    }
    if (!forzar && this.productoExactoSeleccionado()) {
      this.cerrarLista(false);
      return;
    }
    this.abierto = true;
    this.sincronizarPortal();
    this.prepararListaVisible(!this.vistaAsegurada);
    if (this.listaVisible) this.vistaAsegurada = true;
  }

  onBlur(): void {
    if (this.blurTimer != null) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && this.rootEl?.nativeElement.contains(ae)) return;
      if (ae?.closest?.('.producto-ac-sugerencias')) return;
      this.cerrarLista(true);
    }, 160);
  }

  onTexto(value: string): void {
    if (this.disabled) return;
    this.bloqueoReabrir = false;
    this.texto = value;
    this.indiceActivo = -1;
    this.abierto = true;
    this.sincronizarPortal();
    this.prepararListaVisible(!this.vistaAsegurada);
    if (this.listaVisible) this.vistaAsegurada = true;
    const exacto = this.productos.find(
      (p) => p.nombre.toLowerCase() === value.trim().toLowerCase()
    );
    const id = exacto ? exacto.id : null;
    if (id !== this.productoId) {
      this.productoId = id;
      this.productoIdChange.emit(id);
    }
  }

  elegir(p: InventarioItem): void {
    if (this.blurTimer != null) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.texto = p.nombre;
    this.productoId = p.id;
    this.productoIdChange.emit(p.id);
    this.bloqueoReabrir = true;
    this.cerrarLista(false);
    if (this.enterAvanza) {
      queueMicrotask(() => this.enterConfirmado.emit());
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  alPointerFuera(ev: Event): void {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.producto-ac') || t?.closest?.('.producto-ac-sugerencias')) return;
    if (!this.abierto) return;
    this.cerrarLista(true);
  }

  @HostListener('window:resize')
  alResize(): void {
    if (this.listaVisible) this.actualizarDireccion();
  }

  private cerrarLista(aplicarSeleccion: boolean): void {
    this.abierto = false;
    this.indiceActivo = -1;
    this.estiloLista = null;
    this.abreArriba = false;
    this.vistaAsegurada = false;
    this.destruirPortal();
    this.desligarScroll();
    this.limpiarStickTimers();
    if (aplicarSeleccion) this.cerrarSeleccion();
  }

  private limpiarStickTimers(): void {
    for (const t of this.stickTimers) clearTimeout(t);
    this.stickTimers = [];
  }

  private sincronizarPortal(): void {
    if (!this.listaVisible) {
      this.destruirPortal();
      return;
    }
    if (this.portalView || !this.listaTpl) return;
    this.portalView = this.listaTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    for (const node of this.portalView.rootNodes) {
      if (node instanceof Node) document.body.appendChild(node);
    }
    this.portalView.detectChanges();
  }

  private destruirPortal(): void {
    if (!this.portalView) return;
    this.appRef.detachView(this.portalView);
    this.portalView.destroy();
    this.portalView = null;
  }

  private prepararListaVisible(asegurarVista = false): void {
    const el = this.inputEl?.nativeElement;
    if (asegurarVista && el && this.esLayoutMovil()) {
      // Centrar el input para poder abrir la lista ABAJO (UX natural).
      this.ignorarScrollHasta = Date.now() + 500;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    this.ligarScroll();
    this.actualizarDireccion();
    this.programarReposicion();
    this.limpiarStickTimers();
    // Paneles colapsables / teclado mueven el input sin disparar scroll.
    for (const ms of [50, 120, 250, 450]) {
      this.stickTimers.push(
        setTimeout(() => {
          if (this.listaVisible) this.actualizarDireccion();
        }, ms)
      );
    }
  }

  private programarReposicion(): void {
    if (this.posRaf != null) cancelAnimationFrame(this.posRaf);
    this.posRaf = requestAnimationFrame(() => {
      this.posRaf = null;
      if (this.listaVisible) this.actualizarDireccion();
    });
  }

  private inputFueraDeVista(margenFrac = 0.05): boolean {
    const el = this.inputEl?.nativeElement;
    if (!el) return true;
    const rect = el.getBoundingClientRect();
    const vp = this.viewportMetrics();
    const margen = vp.height * margenFrac;
    return rect.bottom < vp.top + margen || rect.top > vp.bottom - margen;
  }

  private ligarScroll(): void {
    if (typeof document === 'undefined') return;
    if (!this.scrollBound) {
      document.addEventListener('scroll', this.onScrollCapture, true);
      this.scrollBound = true;
    }
    if (!this.vvBound && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onVisualViewport);
      window.visualViewport.addEventListener('scroll', this.onVisualViewport);
      this.vvBound = true;
    }
    if (!this.layoutObs && typeof ResizeObserver !== 'undefined') {
      this.layoutObs = new ResizeObserver(() => {
        if (this.listaVisible) this.programarReposicion();
      });
      this.layoutObs.observe(document.documentElement);
      const main = document.querySelector('main');
      if (main) this.layoutObs.observe(main);
      const input = this.inputEl?.nativeElement;
      if (input) this.layoutObs.observe(input);
    }
  }

  private desligarScroll(): void {
    if (typeof document === 'undefined') return;
    if (this.scrollBound) {
      document.removeEventListener('scroll', this.onScrollCapture, true);
      this.scrollBound = false;
    }
    if (this.vvBound && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onVisualViewport);
      window.visualViewport.removeEventListener('scroll', this.onVisualViewport);
      this.vvBound = false;
    }
    if (this.layoutObs) {
      this.layoutObs.disconnect();
      this.layoutObs = null;
    }
  }

  private productoExactoSeleccionado(): boolean {
    if (this.productoId == null || !this.texto.trim()) return false;
    const p = this.productos.find((x) => x.id === this.productoId);
    return !!p && p.nombre.trim().toLowerCase() === this.texto.trim().toLowerCase();
  }

  private scrollActivo(): void {
    setTimeout(() => {
      const activo = document.querySelector(
        '.producto-ac-sugerencias li.activo'
      ) as HTMLElement | null;
      activo?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  private viewportMetrics(): { top: number; bottom: number; height: number } {
    const vv = window.visualViewport;
    if (vv) {
      return {
        top: vv.offsetTop,
        bottom: vv.offsetTop + vv.height,
        height: vv.height,
      };
    }
    return { top: 0, bottom: window.innerHeight, height: window.innerHeight };
  }

  private esLayoutMovil(): boolean {
    return window.matchMedia('(max-width: 1024px)').matches;
  }

  private actualizarDireccion(): void {
    const el = this.inputEl?.nativeElement;
    if (!el || !this.listaVisible) {
      this.abreArriba = false;
      this.estiloLista = null;
      return;
    }

    this.sincronizarPortal();
    if (this.portalView) this.portalView.detectChanges();

    const movil = this.esLayoutMovil();
    const vp = this.viewportMetrics();
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const navReserve = movil ? 56 : 0;
    const espacioAbajo = vp.bottom - rect.bottom - pad - navReserve;
    const espacioArriba = rect.top - vp.top - pad;
    const gap = 4;
    const tope = Math.min(vp.height * 0.42, movil ? 260 : 360);

    // Preferir ABAJO (pegada al input). Solo arriba si abajo no cabe.
    this.abreArriba = espacioAbajo < 110 && espacioArriba > espacioAbajo + 24;

    let top: number | 'auto';
    let bottom: string;
    let maxH: number;
    if (this.abreArriba) {
      // Anclar el borde inferior al input (bottom), no asumir altura del contenido.
      maxH = Math.max(96, Math.min(tope, espacioArriba));
      top = 'auto';
      bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
    } else {
      top = rect.bottom + gap;
      bottom = 'auto';
      maxH = Math.max(
        96,
        Math.min(tope, Math.max(espacioAbajo, 96), vp.bottom - navReserve - top - pad)
      );
    }

    this.estiloLista = {
      position: 'fixed',
      left: `${Math.round(rect.left)}px`,
      width: `${Math.round(rect.width)}px`,
      top: top === 'auto' ? 'auto' : `${Math.round(top)}px`,
      bottom,
      maxHeight: `${Math.round(maxH)}px`,
      zIndex: '5000',
    };
    if (this.portalView) this.portalView.detectChanges();
  }

  private sincronizarDesdeId(): void {
    if (this.productoId == null) {
      if (!this.abierto) this.texto = '';
      return;
    }
    const p = this.productos.find((x) => x.id === this.productoId);
    if (p) this.texto = p.nombre;
  }

  private cerrarSeleccion(): void {
    if (this.productoId != null) {
      const p = this.productos.find((x) => x.id === this.productoId);
      if (p) {
        this.texto = p.nombre;
        return;
      }
    }
    const exacto = this.productos.find(
      (p) => p.nombre.toLowerCase() === this.texto.trim().toLowerCase()
    );
    if (exacto) {
      this.texto = exacto.nombre;
      this.productoId = exacto.id;
      this.productoIdChange.emit(exacto.id);
      return;
    }
    if (this.texto.trim()) {
      this.texto = '';
      this.productoId = null;
      this.productoIdChange.emit(null);
    }
  }
}
