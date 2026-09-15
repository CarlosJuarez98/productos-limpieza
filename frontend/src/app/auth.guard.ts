import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Rutas de la app: exige sesión viva. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  return auth.me({ force: online }).pipe(
    map((m) => (m.authenticated ? true : router.createUrlTree(['/login'])))
  );
};

/** Solo login: si ya hay sesión, manda a Ventas. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Solo fuerza /me si creemos estar autenticados (para redirigir a ventas).
  return auth.me({ force: auth.autenticado }).pipe(
    map((m) => (!m.authenticated ? true : router.createUrlTree(['/ventas'])))
  );
};
