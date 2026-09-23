import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './auth.interceptor';
import { offlineInterceptor } from './offline.interceptor';

function serviceWorkerEnabled(): boolean {
  if (isDevMode()) return false;
  if (typeof location === 'undefined') return true;
  const h = location.hostname;
  // Nunca SW en local: Chrome lo reusa entre ng serve y builds y oculta la vista previa
  return h !== 'localhost' && h !== '127.0.0.1';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // offline antes de auth: las peticiones de sync llevan header y pasan; el resto usa credenciales en auth.
    provideHttpClient(withInterceptors([offlineInterceptor, authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: serviceWorkerEnabled(),
      registrationStrategy: 'registerWhenStable:5000',
    }),
  ],
};
