import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AlertDialogService } from './alert-dialog.service';

/**
 * Puente: cuando la página asigna ok/error, muestra el modal centrado global
 * y limpia el campo para no dejar el banner inline.
 *
 * Uso: <app-page-alerts [(ok)]="ok" [(error)]="error" />
 */
@Component({
  selector: 'app-page-alerts',
  standalone: true,
  template: '',
})
export class PageAlertsComponent {
  @Output() okChange = new EventEmitter<string>();
  @Output() errorChange = new EventEmitter<string>();

  constructor(private alerts: AlertDialogService) {}

  @Input() set ok(v: string | null | undefined) {
    const t = (v || '').trim();
    if (!t) return;
    this.alerts.ok(t);
    queueMicrotask(() => this.okChange.emit(''));
  }

  @Input() set error(v: string | null | undefined) {
    const t = (v || '').trim();
    if (!t) return;
    this.alerts.error(t);
    queueMicrotask(() => this.errorChange.emit(''));
  }
}
