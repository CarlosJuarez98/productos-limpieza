import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/** En local, un SW viejo deja JS/imágenes cacheados: la vista previa falla salvo en incógnito. */
async function purgeDevServiceWorker(): Promise<boolean> {
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!local) return false;

  let hadSw = false;
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    hadSw = regs.length > 0 || !!navigator.serviceWorker.controller;
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  return hadSw;
}

purgeDevServiceWorker()
  .then((hadSw) => {
    if (hadSw && !sessionStorage.getItem('pl-sw-purged')) {
      sessionStorage.setItem('pl-sw-purged', '1');
      location.reload();
      return;
    }
    return bootstrapApplication(AppComponent, appConfig);
  })
  .catch((err) => console.error(err));
