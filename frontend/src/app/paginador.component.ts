import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-paginador',
  standalone: true,
  template: `
    @if (mostrar) {
      <div class="paginador" role="navigation" [attr.aria-label]="ariaLabel">
        @if (pagina > 1) {
          <button type="button" class="secondary" (click)="irAnterior()">Anterior</button>
        } @else {
          <span class="paginador-slot" aria-hidden="true"></span>
        }
        <span class="paginador-info">
          {{ desde }}–{{ hasta }} de {{ total }} · pág. {{ pagina }}/{{ totalPaginas }}
        </span>
        @if (pagina < totalPaginas) {
          <button type="button" class="secondary" (click)="irSiguiente()">Siguiente</button>
        } @else {
          <span class="paginador-slot" aria-hidden="true"></span>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .paginador {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.45rem;
        margin-top: 0.65rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--line);
      }
      .paginador-info {
        flex: 1 1 auto;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
      .paginador-slot {
        flex: 0 0 auto;
        min-width: 5.75rem;
      }
      .paginador button {
        min-width: 5.75rem;
        padding: 0.4rem 0.7rem;
      }
      @media (max-width: 767px) {
        .paginador button,
        .paginador-slot {
          flex: 1 1 0;
          min-width: 0;
          min-height: 2.55rem;
        }
        .paginador-info {
          flex: 1 1 100%;
          order: -1;
          font-size: 0.84rem;
        }
      }
      @media (max-width: 1024px) and (orientation: landscape) {
        .paginador button,
        .paginador-slot {
          flex: 1 1 0;
          min-width: 0;
          min-height: 2.55rem;
        }
        .paginador-info {
          flex: 1 1 100%;
          order: -1;
          font-size: 0.84rem;
        }
      }
    `,
  ],
})
export class PaginadorComponent {
  @Input() total = 0;
  @Input() pagina = 1;
  @Input() pageSize = 25;
  @Input() ariaLabel = 'Paginación';
  /** Selector CSS opcional del ancla al cambiar de página. */
  @Input() scrollAncla: string | null = null;
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  constructor(private host: ElementRef<HTMLElement>) {}

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get mostrar(): boolean {
    return this.total > this.pageSize;
  }

  get desde(): number {
    if (!this.total) return 0;
    return (this.pagina - 1) * this.pageSize + 1;
  }

  get hasta(): number {
    return Math.min(this.pagina * this.pageSize, this.total);
  }

  irAnterior(): void {
    if (this.pagina <= 1) return;
    this.prev.emit();
    this.programarScrollInicio();
  }

  irSiguiente(): void {
    if (this.pagina >= this.totalPaginas) return;
    this.next.emit();
    this.programarScrollInicio();
  }

  private programarScrollInicio(): void {
    setTimeout(() => this.scrollAlInicioLista(), 0);
    setTimeout(() => this.scrollAlInicioLista(), 80);
    setTimeout(() => this.scrollAlInicioLista(), 200);
  }

  private scrollAlInicioLista(): void {
    const ancla = this.resolverAncla();
    if (!ancla) return;

    const panel = this.host.nativeElement.closest(
      'section.panel, section, .panel, .lista-grupo, .registro-col, article, .panel-toggle-body'
    ) as HTMLElement | null;
    const raiz = panel || ancla.parentElement || ancla;
    raiz.querySelectorAll('.table-wrap, .hist-cards, .lista-cuerpo').forEach((el) => {
      if (el instanceof HTMLElement) el.scrollTop = 0;
    });

    this.scrollMainA(ancla);
  }

  private scrollMainA(ancla: HTMLElement): void {
    const main = document.querySelector('main') as HTMLElement | null;
    if (!main) {
      ancla.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }
    const y =
      ancla.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 8;
    main.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  }

  private resolverAncla(): HTMLElement | null {
    if (this.scrollAncla) {
      const custom = document.querySelector(this.scrollAncla);
      if (custom instanceof HTMLElement) return custom;
    }

    const lista = this.listaAsociada();
    if (lista) return this.cabeceraDeLista(lista);

    const marcado = this.buscarHaciaArriba(
      this.host.nativeElement,
      (el) => el.hasAttribute('data-pag-top')
    );
    if (marcado) return marcado;

    const panel = this.host.nativeElement.closest(
      'section.panel, section, .panel, .lista-grupo, .registro-col, article, .panel-toggle-body'
    ) as HTMLElement | null;
    if (!panel) return this.host.nativeElement;

    const cab = panel.querySelector(
      '[data-pag-top], .lista-toggle, .grupo-cab, .toolbar-lista, .toolbar, .panel-titulo, h3, h2, h5'
    ) as HTMLElement | null;
    if (cab && this.visible(cab)) return cab;

    return this.primeraListaVisible(panel) || panel;
  }

  /** Lista que pertenece a este paginador (hermanos anteriores visibles). */
  private listaAsociada(): HTMLElement | null {
    let el: Element | null = this.host.nativeElement.previousElementSibling;
    while (el) {
      if (el instanceof HTMLElement && this.visible(el)) {
        if (this.esContenedorLista(el)) return el;
        const inner = this.primeraListaVisible(el);
        if (inner) return inner;
      }
      el = el.previousElementSibling;
    }

    const parent = this.host.nativeElement.parentElement;
    if (!parent) return null;
    const hijos = Array.from(parent.children);
    const idx = hijos.indexOf(this.host.nativeElement);
    for (let i = idx - 1; i >= 0; i--) {
      const h = hijos[i];
      if (!(h instanceof HTMLElement) || !this.visible(h)) continue;
      if (this.esContenedorLista(h)) return h;
      const inner = this.primeraListaVisible(h);
      if (inner) return inner;
    }
    return null;
  }

  /** Título/toolbar justo antes de la lista, o la lista misma. */
  private cabeceraDeLista(lista: HTMLElement): HTMLElement {
    let prev: Element | null = lista.previousElementSibling;
    while (prev) {
      if (prev instanceof HTMLElement && this.visible(prev)) {
        if (
          prev.matches(
            '[data-pag-top], .lista-toggle, .grupo-cab, .toolbar-lista, .toolbar, .resultados-toolbar, h2, h3, h4, h5, .panel-titulo, .bloque-titulo'
          )
        ) {
          return prev;
        }
        // Si el hermano anterior es otra vista de la misma lista (p.ej. table-wrap),
        // seguir buscando el encabezado.
        if (this.esContenedorLista(prev)) {
          prev = prev.previousElementSibling;
          continue;
        }
        break;
      }
      prev = prev.previousElementSibling;
    }

    const parent = lista.parentElement;
    if (parent) {
      const cab = parent.querySelector(
        ':scope > [data-pag-top], :scope > .lista-toggle, :scope > .grupo-cab, :scope > .toolbar-lista, :scope > .toolbar, :scope > h3, :scope > h2'
      ) as HTMLElement | null;
      if (cab && this.visible(cab)) return cab;
    }
    return lista;
  }

  private esContenedorLista(el: HTMLElement): boolean {
    return (
      el.classList.contains('table-wrap') ||
      el.classList.contains('hist-tabla') ||
      el.classList.contains('hist-cards') ||
      el.classList.contains('lista-cuerpo') ||
      el.classList.contains('lote-wrap') ||
      (el.tagName === 'UL' && el.classList.contains('hist-cards')) ||
      el.tagName === 'TABLE'
    );
  }

  private primeraListaVisible(raiz: HTMLElement): HTMLElement | null {
    const candidatos = raiz.querySelectorAll(
      '.table-wrap, .hist-tabla, .hist-cards, .lista-cuerpo, table, ul.pedidos-lista, ul.hist-cards'
    );
    for (const el of Array.from(candidatos)) {
      if (el instanceof HTMLElement && this.visible(el)) return el;
    }
    return null;
  }

  private visible(el: HTMLElement): boolean {
    return getComputedStyle(el).display !== 'none';
  }

  private buscarHaciaArriba(
    desde: HTMLElement,
    pred: (el: HTMLElement) => boolean
  ): HTMLElement | null {
    let cur: HTMLElement | null = desde.parentElement;
    while (cur && cur !== document.body) {
      const hit = cur.querySelector('[data-pag-top]');
      if (hit instanceof HTMLElement && pred(hit) && this.visible(hit)) return hit;
      if (pred(cur) && this.visible(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
}
