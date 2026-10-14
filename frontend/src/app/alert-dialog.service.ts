import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AlertTipo = 'ok' | 'error' | 'info';

export interface AlertRequest {
  mensaje: string;
  tipo: AlertTipo;
  titulo: string;
  /** null = no auto-cierra (errores). */
  autoCloseMs: number | null;
  botonTexto: string;
}

@Injectable({ providedIn: 'root' })
export class AlertDialogService {
  private readonly pending$ = new Subject<AlertRequest | null>();
  private seq = 0;

  readonly state$ = this.pending$.asObservable();

  /** Guardado / éxito: toast, se cierra solo (~2 s). No bloquea ni pide Enter. */
  ok(mensaje: string, opts?: { titulo?: string; autoCloseMs?: number }): void {
    this.show(mensaje, 'ok', {
      titulo: opts?.titulo ?? 'Listo',
      autoCloseMs: opts?.autoCloseMs ?? 2000,
      botonTexto: 'Listo',
    });
  }

  /** Error importante: modal hasta Entendido. */
  error(mensaje: string, opts?: { titulo?: string }): void {
    this.show(mensaje, 'error', {
      titulo: opts?.titulo ?? 'Atención',
      autoCloseMs: null,
      botonTexto: 'Entendido',
    });
  }

  /** Aviso leve: toast, se cierra solo. */
  info(mensaje: string, opts?: { titulo?: string; autoCloseMs?: number | null }): void {
    this.show(mensaje, 'info', {
      titulo: opts?.titulo ?? 'Aviso',
      autoCloseMs: opts?.autoCloseMs === undefined ? 2200 : opts.autoCloseMs,
      botonTexto: 'Ok',
    });
  }

  show(
    mensaje: string,
    tipo: AlertTipo,
    opts?: { titulo?: string; autoCloseMs?: number | null; botonTexto?: string }
  ): void {
    const t = (mensaje || '').trim();
    if (!t) return;
    this.seq += 1;
    const defaults =
      tipo === 'error'
        ? { titulo: 'Atención', autoCloseMs: null as number | null, botonTexto: 'Entendido' }
        : tipo === 'ok'
          ? { titulo: 'Listo', autoCloseMs: 2000 as number | null, botonTexto: 'Listo' }
          : { titulo: 'Aviso', autoCloseMs: 2200 as number | null, botonTexto: 'Ok' };
    this.pending$.next({
      mensaje: t,
      tipo,
      titulo: opts?.titulo ?? defaults.titulo,
      autoCloseMs:
        opts?.autoCloseMs === undefined ? defaults.autoCloseMs : opts.autoCloseMs,
      botonTexto: opts?.botonTexto ?? defaults.botonTexto,
    });
  }

  dismiss(): void {
    this.pending$.next(null);
  }
}
