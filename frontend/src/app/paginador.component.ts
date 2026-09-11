import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-paginador',
  standalone: true,
  template: `
    @if (mostrar) {
      <div class="paginador" role="navigation" [attr.aria-label]="ariaLabel">
        <button type="button" class="secondary" (click)="prev.emit()" [disabled]="pagina <= 1">
          Anterior
        </button>
        <span class="paginador-info">
          {{ desde }}–{{ hasta }} de {{ total }} · pág. {{ pagina }}/{{ totalPaginas }}
        </span>
        <button
          type="button"
          class="secondary"
          (click)="next.emit()"
          [disabled]="pagina >= totalPaginas"
        >
          Siguiente
        </button>
      </div>
    }
  `,
  styles: [
    `
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
      .paginador button {
        min-width: 5.75rem;
        padding: 0.4rem 0.7rem;
      }
      @media (max-width: 767px) {
        .paginador button {
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
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

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
}
