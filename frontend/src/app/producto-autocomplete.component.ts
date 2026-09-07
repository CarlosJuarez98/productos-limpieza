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
        [placeholder]="placeholder"
        [required]="required"
        autocomplete="off"
        [name]="inputName"
      />
      @if (abierto && texto.trim()) {
        <ul class="sugerencias" [class.arriba]="abreArriba">
          @for (p of filtrados; track p.id) {
            <li (mousedown)="elegir(p); $event.preventDefault()">{{ p.nombre }}</li>
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
      .sugerencias li:hover {
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
    `,
  ],
})
export class ProductoAutocompleteComponent implements OnChanges {
  @Input() productos: InventarioItem[] = [];
  @Input() productoId: number | null = null;
  @Input() required = false;
  @Input() placeholder = 'Escribe el producto...';
  @Input() inputName = 'productoTexto';
  @Output() productoIdChange = new EventEmitter<number | null>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  texto = '';
  abierto = false;
  abreArriba = false;

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
    this.abierto = true;
    this.actualizarDireccion();
  }

  onTexto(value: string): void {
    this.texto = value;
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
  }

  @HostListener('document:click', ['$event'])
  alClickFuera(ev: MouseEvent): void {
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.producto-ac')) return;
    if (!this.abierto) return;
    this.abierto = false;
    this.cerrarSeleccion();
  }

  @HostListener('window:resize')
  alResize(): void {
    if (this.abierto) this.actualizarDireccion();
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
