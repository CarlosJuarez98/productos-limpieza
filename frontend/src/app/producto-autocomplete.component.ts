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
    <!-- form autocomplete=off + readonly hasta focus: Chrome/Android no mete sugerencias nativas -->
    <form
      class="producto-ac-form"
      ngNoForm
      autocomplete="off"
      (submit)="$event.preventDefault()"
      #root
      (click)="$event.stopPropagation()"
    >
      <div class="producto-ac" [class.abierto]="listaVisible">
        <input
          #inputEl
          type="text"
          inputmode="text"
          enterkeyhint="next"
          [ngModel]="texto"
          (ngModelChange)="onTexto($event)"
          (pointerdown)="soltarNativoAntesDeFoco()"
          (touchstart)="soltarNativoAntesDeFoco()"
          (focus)="onFocusInput()"
          (blur)="onBlur()"
          (keydown)="onKeydown($event)"
          role="combobox"
          [attr.aria-expanded]="listaVisible"
          aria-autocomplete="list"
          [placeholder]="placeholder"
          [required]="required"
          [disabled]="disabled"
          [readOnly]="disabled || nativoBloqueado"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          [attr.name]="inputNameSafe"
          [attr.autocomplete]="'off'"
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
    </form>

    <ng-template #listaTpl>
      <ul
        class="producto-ac-sugerencias"
        [class.arriba]="abreArriba"
        [ngStyle]="estiloLista"
        role="listbox"
        (pointerdown)="onListaPointerDown($event)"
        (pointermove)="onListaPointerMove($event)"
        (pointerup)="onListaPointerUp($event)"
        (pointercancel)="onListaPointerCancel()"
      >
        @for (p of filtrados; track p.id; let i = $index) {
          <li
            role="option"
            [class.activo]="i === indiceActivo"
            [attr.aria-selected]="i === indiceActivo"
            (pointerup)="onItemPointerUp($event, p)"
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
      .producto-ac-form {
        display: block;
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: 0;
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
        right: 0.2rem;
        top: 50%;
        transform: translateY(-50%);
        width: 1.75rem;
        height: 1.75rem;
        min-width: 1.75rem;
        min-height: 1.75rem;
        max-width: 1.75rem;
        max-height: 1.75rem;
        margin: 0;
        border: 0;
        border-radius: 999px;
        background: transparent !important;
        color: #b42318 !important;
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1;
        padding: 0 !important;
        box-shadow: none !important;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        -webkit-tap-highlight-color: transparent;
      }
      .ac-clear:hover,
      .ac-clear:active {
        color: #912018 !important;
        background: color-mix(in srgb, #b42318 12%, #fff) !important;
        transform: translateY(-50%) !important;
        box-shadow: none !important;
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
  /** Readonly hasta el foco: evita el autocompletado nativo de Chrome/Android/iOS. */
  nativoBloqueado = true;

  private bloqueoReabrir = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  /** True mientras el dedo/ratón está en la lista (evita cerrar por blur al hacer scroll). */
  private interactuandoLista = false;
  private ptrId: number | null = null;
  private ptrStartX = 0;
  private ptrStartY = 0;
  private ptrMoved = false;
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

  /**
   * Lista abierta mientras el combo está activo y hay texto.
   * No se oculta por coincidencia exacta: si no, la flecha ↓ no puede
   * recorrer sugerencias (p. ej. «Baston» vs «Baston de madera»).
   */
  get listaVisible(): boolean {
    return this.abierto && !!this.texto.trim();
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

  /**
   * Enfoca y abre teclado móvil.
   * Debe ir en el mismo gesto del usuario (Enter/Siguiente): sin setTimeout.
   * Quita readonly en el DOM al momento; si Angular lo quita después, Android
   * deja el cursor parpadeando sin teclado.
   */
  focus(): void {
    if (this.disabled) return;
    this.nativoBloqueado = false;
    const el = this.inputEl?.nativeElement;
    if (!el) return;
    el.readOnly = false;
    el.focus({ preventScroll: true });
  }

  /**
   * Quitar readonly ANTES del focus (touch/click).
   * Si el input está readonly al enfocar, Android/iOS no abren el teclado.
   * Hay que tocar el DOM ya: el change detection de Angular llega tarde.
   */
  soltarNativoAntesDeFoco(): void {
    if (this.disabled) return;
    this.nativoBloqueado = false;
    const el = this.inputEl?.nativeElement;
    if (el) el.readOnly = false;
  }

  onFocusInput(): void {
    this.nativoBloqueado = false;
    this.abrir();
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
    if (ev.key === 'ArrowDown') {
      if (!this.texto.trim()) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.abrir(true);
      const list = this.filtrados;
      if (list.length === 0) return;
      this.indiceActivo = this.indiceActivo < list.length - 1 ? this.indiceActivo + 1 : 0;
      this.refrescarPortal();
      this.scrollActivo();
      return;
    }
    if (ev.key === 'ArrowUp') {
      if (!this.texto.trim()) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.abrir(true);
      const list = this.filtrados;
      if (list.length === 0) return;
      this.indiceActivo = this.indiceActivo > 0 ? this.indiceActivo - 1 : list.length - 1;
      this.refrescarPortal();
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
    const list = this.filtrados;
    const q = this.texto.trim().toLowerCase();
    const exacto = list.find((p) => p.nombre.toLowerCase() === q);
    if (this.listaVisible && list.length > 0) {
      ke.preventDefault();
      // Nombre completo escrito → ese producto; si no, el activo o el primero.
      const elegido =
        exacto ||
        (this.indiceActivo >= 0 ? list[this.indiceActivo] : null) ||
        list[0];
      this.elegir(elegido);
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
      // Solo bloquea el focus post-elegir; flechas deben poder reabrir.
      if (!forzar) return;
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
    // «Siguiente» / avance a cantidad: solo cerrar lista; no pelear con el nuevo foco.
    const cerrarSuave = () => {
      this.cerrarLista(true);
      const ae = document.activeElement as HTMLElement | null;
      // Si el foco quedó en cantidad/precio de la misma card, no rebloquear nativo aquí.
      if (ae?.closest?.('.linea-card, .ticket')) return;
      this.nativoBloqueado = true;
    };
    if (!this.interactuandoLista) {
      // Dejar que el foco llegue a cantidad en el mismo turno (Enter/Siguiente).
      queueMicrotask(cerrarSuave);
      return;
    }
    this.blurTimer = setTimeout(() => {
      if (this.interactuandoLista) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && this.rootEl?.nativeElement.contains(ae)) return;
      if (ae?.closest?.('.producto-ac-sugerencias')) return;
      cerrarSuave();
    }, 220);
  }

  /**
   * Móvil: pointerdown en el ítem seleccionaba al intentar hacer scroll.
   * Solo elegimos en pointerup si el dedo no se movió (tap).
   * En mouse sí preventDefault para no perder el foco del input.
   */
  onListaPointerDown(ev: PointerEvent): void {
    if ((ev.target as HTMLElement | null)?.closest?.('li.vacio')) return;
    this.interactuandoLista = true;
    this.ptrId = ev.pointerId;
    this.ptrStartX = ev.clientX;
    this.ptrStartY = ev.clientY;
    this.ptrMoved = false;
    if (ev.pointerType === 'mouse') {
      ev.preventDefault();
    }
  }

  onListaPointerMove(ev: PointerEvent): void {
    if (this.ptrId == null || ev.pointerId !== this.ptrId) return;
    if (
      Math.abs(ev.clientX - this.ptrStartX) > 10 ||
      Math.abs(ev.clientY - this.ptrStartY) > 10
    ) {
      this.ptrMoved = true;
    }
  }

  onListaPointerUp(ev: PointerEvent): void {
    if (this.ptrId != null && ev.pointerId !== this.ptrId) return;
    this.ptrId = null;
    // Dejar que blur/click terminen antes de soltar el flag.
    setTimeout(() => {
      this.interactuandoLista = false;
    }, 220);
  }

  onListaPointerCancel(): void {
    this.ptrId = null;
    this.ptrMoved = true;
    this.interactuandoLista = false;
  }

  onItemPointerUp(ev: PointerEvent, p: InventarioItem): void {
    if ((ev.target as HTMLElement | null)?.closest?.('li.vacio')) return;
    if (this.ptrMoved) return;
    // Tap corto → elegir (no al inicio del gesto, para poder scrollear).
    ev.preventDefault();
    this.elegir(p);
  }

  onTexto(value: string): void {
    if (this.disabled) return;
    this.bloqueoReabrir = false;
    this.texto = value;
    this.indiceActivo = -1;
    const exacto = this.productos.find(
      (p) => p.nombre.toLowerCase() === value.trim().toLowerCase()
    );
    const id = exacto ? exacto.id : null;
    if (id !== this.productoId) {
      this.productoId = id;
      this.productoIdChange.emit(id);
    }
    // Coincidencia exacta y única → no dejar la lista abierta encima de cantidad.
    const extras = this.filtrados.filter((p) => !exacto || p.id !== exacto.id);
    if (exacto && extras.length === 0) {
      this.abierto = false;
      this.destruirPortal();
      this.vistaAsegurada = false;
      return;
    }
    this.abierto = true;
    this.sincronizarPortal();
    this.prepararListaVisible(!this.vistaAsegurada);
    if (this.listaVisible) this.vistaAsegurada = true;
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
    // Síncrono: microtask sale del gesto y Android cierra el teclado al ir a cantidad.
    if (this.enterAvanza) {
      this.enterConfirmado.emit();
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
    if (asegurarVista && el && this.esLayoutMovil() && this.inputFueraDeVista(0.12)) {
      // Solo si casi no se ve. No forzar scroll: pelea con enfocarCaptura / teclado.
      this.ignorarScrollHasta = Date.now() + 400;
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    this.ligarScroll();
    this.actualizarDireccion();
    this.programarReposicion();
    this.limpiarStickTimers();
    // Teclado / visualViewport: reanclar sin mover la página.
    for (const ms of [80, 200, 400]) {
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

  /** El portal está en body: hay que forzar CD al cambiar indiceActivo. */
  private refrescarPortal(): void {
    this.sincronizarPortal();
    this.portalView?.detectChanges();
  }

  /**
   * Mueve el ítem activo dentro del ul sin scrollIntoView (eso desplaza
   * main/página y el listener de scroll cerraba la lista).
   */
  private scrollActivo(): void {
    queueMicrotask(() => {
      this.refrescarPortal();
      const lista = this.portalView?.rootNodes?.find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('producto-ac-sugerencias')
      );
      const activo = lista?.querySelector('li.activo') as HTMLElement | null;
      if (!lista || !activo) return;
      const top = activo.offsetTop;
      const bottom = top + activo.offsetHeight;
      if (top < lista.scrollTop) {
        lista.scrollTop = top;
      } else if (bottom > lista.scrollTop + lista.clientHeight) {
        lista.scrollTop = bottom - lista.clientHeight;
      }
    });
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

    // Preferir ABAJO con fuerza: arriba solo si abajo casi no cabe.
    this.abreArriba = espacioAbajo < 88 && espacioArriba > 160;

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
