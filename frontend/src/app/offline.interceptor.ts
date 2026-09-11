import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { OfflineService, OFFLINE_SYNC_HEADER } from './offline.service';

function isApi(url: string): boolean {
  return url.includes('/api/');
}

function isAuth(url: string): boolean {
  return url.includes('/api/auth/');
}

function isMutation(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse)) return false;
  return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
}

function pathOnly(url: string): string {
  try {
    if (url.startsWith('http')) {
      const u = new URL(url);
      return u.pathname + u.search;
    }
  } catch {
    /* ignore */
  }
  return url;
}

/**
 * Offline para todos los usuarios:
 * - GET online: cachea respuesta
 * - GET offline / sin red: sirve cache
 * - mutaciones offline / sin red: encola y responde OK sintético
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const offline = inject(OfflineService);

  if (req.headers.has(OFFLINE_SYNC_HEADER)) {
    return next(req);
  }
  if (!isApi(req.url) || isAuth(req.url)) {
    return next(req);
  }

  const method = req.method.toUpperCase();
  const url = pathOnly(req.urlWithParams || req.url);
  let body: unknown = null;
  if (req.body != null) {
    body = typeof req.body === 'string' ? tryParse(req.body) : req.body;
  }

  // Sin conexión: no intentar red.
  if (!offline.online) {
    if (isMutation(method)) {
      return from(offline.enqueue(method, url, body)).pipe(
        switchMap(() => of(offline.syntheticSuccess(method, body)))
      );
    }
    return from(offline.getCached(method, url)).pipe(
      switchMap((cached) => {
        if (cached !== null && cached !== undefined) {
          return of(new HttpResponse({ status: 200, body: cached }));
        }
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              statusText: 'Offline',
              url,
              error: { error: 'Sin conexión y sin datos guardados para esta pantalla. Entra en línea una vez para cachear.' },
            })
        );
      })
    );
  }

  // Con conexión: normal + cache; si cae la red, degradar a offline.
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && method === 'GET' && event.status >= 200 && event.status < 300) {
        void offline.putCache(method, url, event.status, event.body);
      }
    }),
    catchError((err: unknown) => {
      if (!isNetworkFailure(err)) {
        return throwError(() => err);
      }
      offline.online$.next(false);
      if (isMutation(method)) {
        return from(offline.enqueue(method, url, body)).pipe(
          switchMap(() => of(offline.syntheticSuccess(method, body)))
        );
      }
      return from(offline.getCached(method, url)).pipe(
        switchMap((cached) => {
          if (cached !== null && cached !== undefined) {
            return of(new HttpResponse({ status: 200, body: cached }));
          }
          return throwError(() => err);
        })
      );
    })
  );
};

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
