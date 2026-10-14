import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertDialogService, AlertRequest } from './alert-dialog.service';

/**
 * Errores → modal (hay que leer / Entendido).
 * Éxito e info → toast arriba, se cierra solo (sin botón obligatorio).
 */
@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (abierto && req) {
      @if (req.tipo === 'error') {
        <div class="overlay" (click)="cerrar()" role="presentation">
          <div
            class="dialog tipo-error"
            tabindex="-1"
            (click)="$event.stopPropagation()"
            role="alertdialog"
            aria-modal="true"
            [attr.aria-label]="req.titulo"
          >
            <h3>{{ req.titulo }}</h3>
            <p class="mensaje">{{ req.mensaje }}</p>
            <div class="actions">
              <button type="button" class="btn-alert" (click)="cerrar()">
                {{ req.botonTexto }}
              </button>
            </div>
          </div>
        </div>
      } @else {
        <div
          class="toast"
          [class.tipo-ok]="req.tipo === 'ok'"
          [class.tipo-info]="req.tipo === 'info'"
          role="status"
          aria-live="polite"
          (click)="cerrar()"
        >
          <div class="toast-body">
            <strong class="toast-tit">{{ req.titulo }}</strong>
            <span class="toast-msg">{{ req.mensaje }}</span>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 1100;
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
      .dialog.tipo-error {
        border-top: 4px solid #c44949;
      }
      .dialog h3 {
        margin: 0 0 0.55rem;
        font-size: 1.2rem;
        color: #a33;
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
      }
      .btn-alert {
        min-height: 2.6rem;
        min-width: 7rem;
        font-weight: 700;
        background: #c44949;
        border-color: #c44949;
        color: #fff;
      }
      .toast {
        position: fixed;
        left: 50%;
        top: max(0.75rem, env(safe-area-inset-top, 0px));
        transform: translateX(-50%);
        z-index: 1100;
        width: min(420px, calc(100% - 1.5rem));
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.75rem 0.95rem;
        border-radius: 0.65rem;
        border: 1px solid var(--line);
        background: #fff;
        box-shadow: 0 12px 32px rgba(22, 53, 40, 0.18);
        cursor: pointer;
        animation: toast-in 0.22s ease-out;
      }
      .toast.tipo-ok {
        border-left: 4px solid #2f8f5b;
      }
      .toast.tipo-info {
        border-left: 4px solid #3a78a0;
      }
      .toast-body {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }
      .toast-tit {
        font-size: 0.92rem;
        color: #1f6b45;
      }
      .toast.tipo-info .toast-tit {
        color: #2a5f7a;
      }
      .toast-msg {
        font-size: 0.9rem;
        color: var(--muted);
        line-height: 1.35;
        white-space: pre-line;
      }
      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-0.5rem);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @media (max-width: 767px) {
        .dialog {
          padding: 1.15rem 1rem 1rem;
        }
        .dialog .actions button {
          width: 100%;
          min-height: 2.85rem;
          font-size: 1.05rem;
        }
        .toast {
          top: max(0.55rem, env(safe-area-inset-top, 0px));
        }
      }
    `,
  ],
})
export class AlertDialogComponent implements OnInit, OnDestroy {
  abierto = false;
  req: AlertRequest | null = null;
  private sub?: Subscription;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private abiertoEn = 0;

  constructor(private alerts: AlertDialogService) {}

  ngOnInit(): void {
    this.sub = this.alerts.state$.subscribe((req) => {
      this.limpiarTimer();
      this.abierto = !!req;
      this.req = req;
      if (req) {
        this.abiertoEn = Date.now();
        if (req.tipo === 'error') {
          setTimeout(() => {
            document.querySelector<HTMLElement>('app-alert-dialog .dialog')?.focus();
          });
        }
        if (req.autoCloseMs != null && req.autoCloseMs > 0) {
          this.autoTimer = setTimeout(() => this.cerrar(), req.autoCloseMs);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.limpiarTimer();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.abierto || !this.req) return;
    // Solo el modal de error captura Enter/Esc; el toast no interrumpe la captura.
    if (this.req.tipo !== 'error') {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.cerrar();
      }
      return;
    }
    if (Date.now() - this.abiertoEn < 120) return;
    if (ev.key === 'Enter' || ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.cerrar();
    }
  }

  cerrar(): void {
    this.limpiarTimer();
    this.abierto = false;
    this.req = null;
    this.alerts.dismiss();
  }

  private limpiarTimer(): void {
    if (this.autoTimer != null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }
}
