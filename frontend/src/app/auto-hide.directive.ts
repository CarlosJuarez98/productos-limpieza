import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

/** Oculta alertas de éxito/error tras unos segundos. Uso: appAutoHide (autoHide)="msg = ''" */
@Directive({
  selector: '[appAutoHide]',
  standalone: true,
})
export class AutoHideDirective implements OnInit, OnDestroy {
  /** Opcional: [autoHideMs]="5000". Por defecto 4 s. */
  @Input() autoHideMs = 4000;
  @Output() autoHide = new EventEmitter<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.programar();
  }

  ngOnDestroy(): void {
    this.limpiar();
  }

  private programar(): void {
    this.limpiar();
    const ms = Number(this.autoHideMs);
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 4000;
    this.timer = setTimeout(() => this.autoHide.emit(), delay);
  }

  private limpiar(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
