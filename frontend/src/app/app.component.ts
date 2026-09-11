import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { PullRefreshService } from './pull-refresh.service';
import { AuthService } from './auth.service';

type NavLink = { path: string; label: string; short?: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mainScroll') mainRef!: ElementRef<HTMLElement>;
  @ViewChild('topNav') topNavRef?: ElementRef<HTMLElement>;

  /** Escritorio: todas las secciones. */
  readonly links: NavLink[] = [
    { path: '/ventas', label: 'Ventas' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/entradas', label: 'Entrada de proveedor', short: 'Entradas' },
    { path: '/surtir', label: 'Surtir' },
    { path: '/traspasos', label: 'Traspasos' },
    { path: '/caja', label: 'Caja' },
    { path: '/apartados', label: 'Apartados' },
    { path: '/inversion', label: 'Inversión' },
    { path: '/precios', label: 'Histórico precios', short: 'Precios' },
    { path: '/uso-casa', label: 'Uso en casa', short: 'Uso casa' },
    { path: '/lista-precios', label: 'Lista precios', short: 'Lista' },
  ];

  /** Móvil: barra inferior (operación diaria). */
  readonly bottomLinks: NavLink[] = [
    { path: '/ventas', label: 'Ventas' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/entradas', label: 'Entradas' },
    { path: '/caja', label: 'Caja' },
  ];

  readonly moreLinks: NavLink[] = [
    { path: '/surtir', label: 'Surtir / Pedido' },
    { path: '/traspasos', label: 'Traspasos' },
    { path: '/apartados', label: 'Apartados' },
    { path: '/inversion', label: 'Inversión' },
    { path: '/precios', label: 'Histórico precios' },
    { path: '/uso-casa', label: 'Uso en casa' },
    { path: '/lista-precios', label: 'Lista precios' },
  ];

  masAbierto = false;
  esLogin = false;
  usuarioActual: string | null = null;

  /** Pull-to-refresh (móvil). */
  pullDistancia = 0;
  pullListo = false;
  private pullInicioY: number | null = null;
  private pullInicioX: number | null = null;
  private pullActivo = false;
  private readonly pullUmbral = 78;

  private mainEl: HTMLElement | null = null;
  private routerSub?: Subscription;
  private authSub?: Subscription;

  get pullVisible(): boolean {
    return this.pullDistancia > 8;
  }

  get masActivo(): boolean {
    return this.moreLinks.some((l) => this.router.url.startsWith(l.path));
  }

  constructor(
    private router: Router,
    private pullRefresh: PullRefreshService,
    private auth: AuthService
  ) {
    this.actualizarEsLogin(this.router.url);
    this.usuarioActual = this.auth.usuario;
    this.authSub = this.auth.authChanges$.subscribe((m) => {
      this.usuarioActual = m?.authenticated
        ? m.displayName || m.username || null
        : null;
    });
    // Restaura sesión al recargar; los guards deciden si hay que ir a /login.
    this.auth.me().subscribe();
  }

  ngAfterViewInit(): void {
    this.mainEl = this.mainRef?.nativeElement ?? null;
    document.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', this.onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true, capture: true });

    this.actualizarEsLogin(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.masAbierto = false;
        this.actualizarEsLogin(e.urlAfterRedirects || e.url);
        this.scrollActiveNavIntoView();
      });
    queueMicrotask(() => this.scrollActiveNavIntoView());
  }

  ngOnDestroy(): void {
    document.removeEventListener('wheel', this.onWheel, true);
    document.removeEventListener('touchstart', this.onTouchStart, true);
    document.removeEventListener('touchmove', this.onTouchMove, true);
    document.removeEventListener('touchend', this.onTouchEnd, true);
    document.removeEventListener('touchcancel', this.onTouchCancel, true);
    this.routerSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  private actualizarEsLogin(url: string): void {
    const path = (url || '').split('?')[0];
    this.esLogin = path === '/login' || path.startsWith('/login/');
  }

  toggleMas(): void {
    this.masAbierto = !this.masAbierto;
  }

  cerrarMas(): void {
    this.masAbierto = false;
  }

  cerrarSesion(): void {
    this.masAbierto = false;
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }

  private scrollActiveNavIntoView(): void {
    const nav = this.topNavRef?.nativeElement;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('a.active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  private onTouchStart = (ev: TouchEvent): void => {
    if (this.esLogin) return;
    if (ev.touches.length !== 1) return;
    if (this.masAbierto) return;
    this.resetPull();
    if (!this.contenidoEnTope(ev.target)) return;
    this.pullInicioY = ev.touches[0].clientY;
    this.pullInicioX = ev.touches[0].clientX;
  };

  private onTouchMove = (ev: TouchEvent): void => {
    if (this.pullInicioY == null || ev.touches.length !== 1) return;
    if (this.masAbierto) {
      this.resetPull();
      return;
    }
    if (!this.contenidoEnTope(ev.target)) {
      this.resetPull();
      return;
    }

    const touch = ev.touches[0];
    const dy = touch.clientY - this.pullInicioY;
    const dx = Math.abs(touch.clientX - (this.pullInicioX ?? touch.clientX));

    // Scroll normal hacia abajo (dedo hacia arriba) o gesto horizontal: no interferir.
    if (dy < 10 || dx > dy) {
      if (dy < -6) this.resetPull();
      return;
    }

    this.pullActivo = true;
    this.pullDistancia = Math.min(120, dy * 0.55);
    this.pullListo = this.pullDistancia >= this.pullUmbral;
    // Solo bloquear el scroll nativo cuando ya es claramente un pull-to-refresh.
    if (this.pullDistancia > 36) {
      ev.preventDefault();
    }
  };

  private onTouchEnd = (): void => {
    if (!this.pullActivo) {
      this.resetPull();
      return;
    }
    const recargar = this.pullListo;
    this.resetPull();
    if (recargar) {
      // Soft refresh: no location.reload() — conserva tickets / formularios.
      this.pullRefresh.trigger();
    }
  };

  private onTouchCancel = (): void => {
    this.resetPull();
  };

  private resetPull(): void {
    this.pullActivo = false;
    this.pullInicioY = null;
    this.pullInicioX = null;
    this.pullDistancia = 0;
    this.pullListo = false;
  }

  /** Solo pull si main (y scroll anidados) están arriba. */
  private contenidoEnTope(target: EventTarget | null): boolean {
    const main = this.mainEl;
    if (main && main.scrollTop > 0) return false;
    let el = target as HTMLElement | null;
    while (el && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollTop > 0) {
        return false;
      }
      el = el.parentElement;
    }
    return true;
  }

  /**
   * Escritorio: rueda fuera de main → scroll de main.
   * Dentro de un área con scroll Y propio (.table-wrap / .ticket) → dejar nativo;
   * solo pasar a main cuando ya estás en el borde.
   */
  private onWheel = (e: WheelEvent): void => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const main = this.mainEl;
    if (!main || e.ctrlKey) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('.overlay, [role="dialog"], app-confirm-dialog, .sugerencias, .mas-sheet')) return;

    const nested = target.closest('.table-wrap, .ticket') as HTMLElement | null;
    if (nested && main.contains(nested)) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const style = getComputedStyle(nested);
      const oy = style.overflowY;
      const scrollsY = oy === 'auto' || oy === 'scroll' || oy === 'overlay';
      const canY = scrollsY && nested.scrollHeight > nested.clientHeight + 1;
      if (!canY) {
        e.preventDefault();
        main.scrollTop += e.deltaY;
        return;
      }

      const atTop = nested.scrollTop <= 0;
      const atBottom = nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
        main.scrollTop += e.deltaY;
      }
      return;
    }

    if (!main.contains(target)) {
      e.preventDefault();
      main.scrollTop += e.deltaY;
    }
  };
}
