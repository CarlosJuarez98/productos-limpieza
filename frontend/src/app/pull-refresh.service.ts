import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Soft refresh desde pull-to-refresh (sin recargar la página ni perder formularios). */
@Injectable({ providedIn: 'root' })
export class PullRefreshService {
  private readonly subject = new Subject<void>();
  readonly refresh$ = this.subject.asObservable();

  trigger(): void {
    this.subject.next();
  }
}
