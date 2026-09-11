import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
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
  template: `
    <div class="producto-ac" #root (click)="$event.stopPropagation()">
      <input
        #inputEl
        type="text"
        [ngModel]="texto"
        (ngModelChange)="onTexto($event)"
        (focus)="abrir()"
        (keydown)="onKeydown($event)"
        role="combobox"
        [attr.aria-expanded]="abierto"
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
          (mousedown)="limpiar($event)"
        >×</button>
      }
      @if (abierto && texto.trim()) {
        <ul class="sugerencias" [class.arriba]="abreArriba" role="listbox">
          @for (p of filtrados; track p.id; let i = $index) {
            <li
              role="option"
              [class.activo]="i === indiceActivo"
              [attr.aria-selected]="i === indiceActivo"
              (mousedown)="elegir(p); $event.preventDefault()"
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
      .producto-ac {
        position: relative;
        z-index: 1;
      }
      .producto-ac:focus-within {
        z-index: 40;
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
export class ProductoAutocompleteComponent implements OnChanges {
  @Input() productos: InventarioItem[] = [];
  @Input() productoId: number | null = null;
  @Input() required = false;
  @Input() disabled = false;
  @Input() placeholder = 'Escribe el producto...';
  @Input() inputName = 'productoTexto';
  /** Extra en sugerencias: stock (inventario) o precio compra. */
  @Input() mostrarExtra: 'ninguno' | 'stock' | 'compra' = 'ninguno';
  @Output() productoIdChange = new EventEmitter<number | null>();
  /** Enter con producto listo: el padre puede pasar a cantidad / siguiente fila. */
  @Output() enterConfirmado = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('root') rootEl?: ElementRef<HTMLElement>;

  texto = '';
  abierto = false;
  abreArriba = false;
  /** Índice resaltado en la lista (-1 = ninguno). */
  indiceActivo = -1;

  focus(): void {
    this.inputEl?.nativeElement?.focus();
  }

  blur(): void {
    this.inputEl?.nativeElement?.blur();
  }

  limpiar(ev: Event): void {
    ev.preventDefault();
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
      this.abrir();
      if (list.length === 0) return;
      this.indiceActivo = this.indiceActivo < list.length - 1 ? this.indiceActivo + 1 : 0;
      this.scrollActivo();
      return;
    }
    if (ev.key === 'ArrowUp') {
      if (!this.abierto || list.length === 0) return;
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
    if (this.abierto && this.filtrados.length > 0) {
      ke.preventDefault();
      const idx = this.indiceActivo >= 0 ? this.indiceActivo : 0;
      this.elegir(this.filtrados[idx]);
      this.enterConfirmado.emit();
      return;
    }
    if (this.productoId != null || this.texto.trim()) {
      ke.preventDefault();
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

  abrir(): void {
    if (this.disabled) return;
    this.abierto = true;
    this.actualizarDireccion();
  }

  onTexto(value: string): void {
    if (this.disabled) return;
    this.texto = value;
    this.indiceActivo = -1;
    this.abrir();
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
    this.texto = p.nombre;
    this.productoId = p.id;
    this.productoIdChange.emit(p.id);
    this.abierto = false;
    this.indiceActivo = -1;
  }

  @HostListener('document:click', ['$event'])
  alClickFuera(ev: MouseEvent): void {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.producto-ac')) return;
    if (!this.abierto) return;
    this.abierto = false;
    this.indiceActivo = -1;
    this.cerrarSeleccion();
  }

  @HostListener('window:resize')
  alResize(): void {
    if (this.abierto) this.actualizarDireccion();
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
      return;
    }
    const rect = el.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom;
    this.abreArriba = espacioAbajo < 280 && rect.top > espacioAbajo;
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
