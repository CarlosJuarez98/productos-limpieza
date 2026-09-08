import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmRequest } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (abierto && req) {
      <div class="overlay" (click)="cancelar()" role="presentation">
        <div
          class="dialog"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="req.titulo"
        >
          <h3>{{ req.titulo }}</h3>
          <p class="mensaje">{{ req.mensaje }}</p>
          <div class="actions">
            <button type="button" class="secondary" (click)="cancelar()">
              {{ req.cancelarTexto }}
            </button>
            <button
              type="button"
              [class.danger]="esEliminar"
              (click)="aceptar()"
            >
              {{ req.confirmarTexto }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(18, 32, 26, 0.45);
        backdrop-filter: blur(2px);
      }
      .dialog {
        width: min(420px, 100%);
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 0.75rem;
        padding: 1.25rem 1.35rem;
        box-shadow: 0 20px 50px rgba(22, 53, 40, 0.22);
        outline: none;
      }
      .dialog h3 {
        margin: 0 0 0.55rem;
        font-size: 1.2rem;
      }
      .dialog p.mensaje {
        margin: 0 0 1.15rem;
        color: var(--muted);
        line-height: 1.45;
        white-space: pre-line;
      }
      .dialog .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  abierto = false;
  req: ConfirmRequest | null = null;
  private sub?: Subscription;
  private abiertoEn = 0;

  constructor(private confirm: ConfirmDialogService) {}

  get esEliminar(): boolean {
    const t = (this.req?.confirmarTexto || '').toLowerCase();
    return t.includes('eliminar') || t.includes('borrar');
  }

  ngOnInit(): void {
    this.sub = this.confirm.state$.subscribe((pending) => {
      this.abierto = !!pending;
      this.req = pending?.request ?? null;
      if (this.abierto) {
        this.abiertoEn = Date.now();
        // Evita que Enter del submit abra y confirme en el mismo golpe.
        setTimeout(() => {
          document.querySelector<HTMLElement>('.dialog')?.focus();
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.abierto) return;
    if (Date.now() - this.abiertoEn < 120) return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      this.aceptar();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.cancelar();
    }
  }

  aceptar(): void {
    this.confirm.accept();
  }

  cancelar(): void {
    this.confirm.cancel();
  }
}
