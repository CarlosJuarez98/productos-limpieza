import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';

export interface AuthMe {
  authenticated: boolean;
  username?: string;
  displayName?: string;
  remainingSeconds?: number;
}

function displayNameOf(username: string | undefined | null): string {
  if (!username) return '';
  const u = username.trim().toLowerCase();
  if (u === 'mama' || u === 'mamá') return 'Mamá';
  if (u === 'admin') return 'Admin';
  return username;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/auth';
  private readonly estado$ = new BehaviorSubject<AuthMe | null>(null);
  /** Un solo /me en vuelo; tras resolver se usa el cache de estado$. */
  private meInflight$: Observable<AuthMe> | null = null;

  readonly authChanges$ = this.estado$.asObservable();

  get listo(): boolean {
    return this.estado$.value !== null;
  }

  get usuario(): string | null {
    const e = this.estado$.value;
    if (!e?.authenticated) return null;
    return e.displayName || displayNameOf(e.username) || e.username || null;
  }

  get autenticado(): boolean {
    return !!this.estado$.value?.authenticated;
  }

  get username(): string | null {
    const e = this.estado$.value;
    return e?.authenticated ? e.username || null : null;
  }

  me(): Observable<AuthMe> {
    const cached = this.estado$.value;
    if (cached !== null) {
      return of(cached);
    }
    if (this.meInflight$) {
      return this.meInflight$;
    }
    this.meInflight$ = this.http.get<AuthMe>(`${this.base}/me`, { withCredentials: true }).pipe(
      map((m) =>
        m.authenticated
          ? { ...m, displayName: m.displayName || displayNameOf(m.username) }
          : m
      ),
      tap((m) => this.estado$.next(m)),
      catchError(() => {
        const empty: AuthMe = { authenticated: false };
        this.estado$.next(empty);
        return of(empty);
      }),
      finalize(() => {
        this.meInflight$ = null;
      }),
      shareReplay(1)
    );
    return this.meInflight$;
  }

  login(username: string, password: string): Observable<void> {
    return this.http
      .post<{ ok: boolean; username: string; displayName?: string }>(
        `${this.base}/login`,
        { username, password },
        { withCredentials: true }
      )
      .pipe(
        tap((r) =>
          this.estado$.next({
            authenticated: true,
            username: r.username,
            displayName: r.displayName || displayNameOf(r.username),
            remainingSeconds: 20 * 60,
          })
        ),
        map(() => undefined)
      );
  }

  logout(): Observable<void> {
    return this.http.post<{ ok: boolean }>(`${this.base}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.estado$.next({ authenticated: false })),
      map(() => undefined),
      catchError(() => {
        this.estado$.next({ authenticated: false });
        return of(undefined);
      })
    );
  }

  marcarNoAutenticado(): void {
    this.estado$.next({ authenticated: false });
  }
}
