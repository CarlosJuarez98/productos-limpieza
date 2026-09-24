import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioItem } from './modelos';

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
        [name]="inputName"
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
      @if (listaVisible) {
        <ul
          class="sugerencias"
          [class.arriba]="abreArriba"
          [class.fija]="listaFija"
          [ngStyle]="listaFija ? estiloListaFija : null"
          role="listbox"
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
      }
    </div>
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
      /* Por encima del th sticky (Folio/Fecha) y de la siguiente tarjeta. */
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
      .sugerencias {
        position: absolute;
        z-index: 50;
        left: 0;
        right: 0;
        top: calc(100% + 2px);
        margin: 0;
        padding: 0.25rem 0;
        list-style: none;
        max-height: min(50vh, 360px);
        overflow: auto;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 0.4rem;
        box-shadow: 0 10px 24px rgba(22, 53, 40, 0.12);
        /* fixed (móvil): escapa stacking del CTA / th Folio */
        &.fija {
          position: fixed;
          right: auto;
          z-index: 2000;
        }
      }
      .sugerencias.arriba {
        top: auto;
        bottom: calc(100% + 2px);
        box-shadow: 0 -8px 24px rgba(22, 53, 40, 0.12);
      }
      .sugerencias li {
        padding: 0.45rem 0.65rem;
        cursor: pointer;
        color: var(--text);
      }
      .sugerencias li:hover,
      .sugerencias li.activo {
        background: #eef5f1;
        color: var(--text);
      }
      .sugerencias li.vacio {
        cursor: default;
        color: var(--muted);
        font-size: 0.9rem;
      }
      .sugerencias li.vacio:hover {
        background: transparent;
      }
      .sugerencias li .extra {
        display: block;
        font-size: 0.8rem;
        color: var(--muted);
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
  /** Extra en sugerencias: stock (inventario) o precio compra. */
  @Input() mostrarExtra: 'ninguno' | 'stock' | 'compra' = 'ninguno';
  /** Si es true, Enter / elegir avanza a cantidad. */
  @Input() enterAvanza = false;
  @Output() productoIdChange = new EventEmitter<number | null>();
  /** Enter con producto listo: el padre puede pasar a cantidad / siguiente fila. */
  @Output() enterConfirmado = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('root') rootEl?: ElementRef<HTMLElement>;

  texto = '';
  abierto = false;
  abreArriba = false;
  /** En móvil/tactil: posición fixed para no quedar bajo Folio/Guardar. */
  listaFija = false;
  estiloListaFija: Record<string, string> | null = null;
  /** Índice resaltado en la lista (-1 = ninguno). */
  indiceActivo = -1;
  /** Evita reabrir la lista al residual-focus tras elegir en móvil. */
  private bloqueoReabrir = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollBound = false;
  private readonly onScrollCapture = (): void => {
    if (this.listaVisible && this.listaFija) this.actualizarDireccion();
  };

  /** Lista solo si hay búsqueda activa; no si ya quedó el producto exacto elegido. */
  get listaVisible(): boolean {
    return this.abierto && !!this.texto.trim() && !this.productoExactoSeleccionado();
  }

  ngOnDestroy(): void {
    this.desligarScroll();
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
    this.abierto = false;
    this.indiceActivo = -1;
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
      this.abierto = false;
      this.indiceActivo = -1;
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
      this.abierto = false;
      this.cerrarSeleccion();
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

  /** @param forzar ignora bloqueo / match exacto (flechas). */
  abrir(forzar = false): void {
    if (this.disabled) return;
    if (this.bloqueoReabrir) {
      this.bloqueoReabrir = false;
      return;
    }
    if (!forzar && this.productoExactoSeleccionado()) {
      this.abierto = false;
      return;
    }
    this.abierto = true;
    this.actualizarDireccion();
    this.ligarScroll();
    setTimeout(() => this.actualizarDireccion(), 0);
  }

  onBlur(): void {
    if (this.blurTimer != null) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && this.rootEl?.nativeElement.contains(ae)) return;
      this.abierto = false;
      this.cerrarSeleccion();
      this.listaFija = false;
      this.estiloListaFija = null;
      this.desligarScroll();
    }, 160);
  }

  onTexto(value: string): void {
    if (this.disabled) return;
    this.bloqueoReabrir = false;
    this.texto = value;
    this.indiceActivo = -1;
    this.abierto = true;
    this.actualizarDireccion();
    this.ligarScroll();
    setTimeout(() => this.actualizarDireccion(), 0);
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
    this.abierto = false;
    this.indiceActivo = -1;
    this.listaFija = false;
    this.estiloListaFija = null;
    this.bloqueoReabrir = true;
    this.desligarScroll();
    // En móvil avanza a cantidad para que la lista no tape el siguiente campo.
    if (this.enterAvanza) {
      queueMicrotask(() => this.enterConfirmado.emit());
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  alPointerFuera(ev: Event): void {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.producto-ac')) return;
    if (!this.abierto) return;
    this.abierto = false;
    this.indiceActivo = -1;
    this.listaFija = false;
    this.estiloListaFija = null;
    this.desligarScroll();
    this.cerrarSeleccion();
  }

  @HostListener('window:resize')
  alResize(): void {
    if (this.listaVisible) this.actualizarDireccion();
  }

  private ligarScroll(): void {
    if (this.scrollBound || typeof document === 'undefined') return;
    document.addEventListener('scroll', this.onScrollCapture, true);
    this.scrollBound = true;
  }

  private desligarScroll(): void {
    if (!this.scrollBound || typeof document === 'undefined') return;
    document.removeEventListener('scroll', this.onScrollCapture, true);
    this.scrollBound = false;
  }

  private productoExactoSeleccionado(): boolean {
    if (this.productoId == null || !this.texto.trim()) return false;
    const p = this.productos.find((x) => x.id === this.productoId);
    return !!p && p.nombre.trim().toLowerCase() === this.texto.trim().toLowerCase();
  }

  private scrollActivo(): void {
    setTimeout(() => {
      const root = this.rootEl?.nativeElement;
      const activo = root?.querySelector('li.activo') as HTMLElement | null;
      activo?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  private actualizarDireccion(): void {
    const el = this.inputEl?.nativeElement;
    if (!el) {
      this.abreArriba = false;
      this.listaFija = false;
      this.estiloListaFija = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom;
    this.abreArriba = espacioAbajo < 280 && rect.top > espacioAbajo;

    // Fijo en tactil: escapa stacking de th Folio y botón Guardar.
    const tactil =
      typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (!tactil || !this.listaVisible) {
      this.listaFija = false;
      this.estiloListaFija = null;
      return;
    }

    this.listaFija = true;
    const maxH = Math.min(window.innerHeight * 0.45, 320);
    const gap = 4;
    if (this.abreArriba) {
      const h = Math.max(120, Math.min(maxH, rect.top - 12));
      this.estiloListaFija = {
        left: `${Math.round(rect.left)}px`,
        width: `${Math.round(rect.width)}px`,
        top: 'auto',
        bottom: `${Math.round(window.innerHeight - rect.top + gap)}px`,
        maxHeight: `${Math.round(h)}px`,
      };
    } else {
      const h = Math.max(120, Math.min(maxH, window.innerHeight - rect.bottom - 12));
      this.estiloListaFija = {
        left: `${Math.round(rect.left)}px`,
        width: `${Math.round(rect.width)}px`,
        top: `${Math.round(rect.bottom + gap)}px`,
        bottom: 'auto',
        maxHeight: `${Math.round(h)}px`,
      };
    }
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
