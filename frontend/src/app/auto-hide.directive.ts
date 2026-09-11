import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

/** Oculta mensajes de éxito tras unos segundos. Uso: <p appAutoHide (autoHide)="ok = ''"> */
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
    const ms = Number(this.autoHideMs);
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 4000;
    this.timer = setTimeout(() => this.autoHide.emit(), delay);
  }

  ngOnDestroy(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
