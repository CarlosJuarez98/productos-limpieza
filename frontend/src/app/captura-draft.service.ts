import { Injectable } from '@angular/core';

/**
 * Conserva capturas a medias al navegar a otra pantalla (mismo tab).
 * sessionStorage: se limpia al cerrar el navegador.
 */
@Injectable({ providedIn: 'root' })
export class CapturaDraftService {
  private prefix = 'pl.captura.draft.';

  save(page: string, data: unknown): void {
    try {
      sessionStorage.setItem(this.prefix + page, JSON.stringify(data));
    } catch {
      /* quota / privado */
    }
  }

  load<T>(page: string): T | null {
    try {
      const raw = sessionStorage.getItem(this.prefix + page);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  clear(page: string): void {
    try {
      sessionStorage.removeItem(this.prefix + page);
    } catch {
      /* ignore */
    }
  }
}
