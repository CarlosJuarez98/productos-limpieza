import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { PullRefreshService } from './pull-refresh.service';
import { AuthService } from './auth.service';
import { OfflineService } from './offline.service';
import { ApiService } from './api.service';
import { capturaTieneFocoEnCampo } from './paginacion.util';

type NavIcon =
  | 'ventas'
  | 'domicilio'
  | 'publicidad'
  | 'inventario'
  | 'entradas'
  | 'surtir'
  | 'traspasos'
  | 'caja'
  | 'apartados'
  | 'inversion'
  | 'precios'
  | 'uso-casa'
  | 'lista'
  | 'menu';

type NavLink = { path: string; label: string; short?: string; icon: NavIcon };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ConfirmDialogComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mainScroll') mainRef!: ElementRef<HTMLElement>;
  @ViewChild('topNav') topNavRef?: ElementRef<HTMLElement>;

  /** Escritorio: secciones frecuentes (el resto va en Más). */
  readonly links: NavLink[] = [
    { path: '/ventas', label: 'Ventas', icon: 'ventas' },
    { path: '/domicilio', label: 'Domicilio', icon: 'domicilio' },
    { path: '/inventario', label: 'Inventario', icon: 'inventario' },
    { path: '/entradas', label: 'Entrada de proveedor', short: 'Entradas', icon: 'entradas' },
    { path: '/surtir', label: 'Surtir', icon: 'surtir' },
    { path: '/traspasos', label: 'Traspasos', icon: 'traspasos' },
    { path: '/caja', label: 'Caja', icon: 'caja' },
    { path: '/apartados', label: 'Apartados', icon: 'apartados' },
    { path: '/inversion', label: 'Inversión', icon: 'inversion' },
    { path: '/precios', label: 'Histórico precios', short: 'Precios', icon: 'precios' },
    { path: '/uso-casa', label: 'Uso en casa', short: 'Uso casa', icon: 'uso-casa' },
  ];

  /** Móvil: barra inferior (operación diaria). */
  readonly bottomLinks: NavLink[] = [
    { path: '/ventas', label: 'Ventas', icon: 'ventas' },
    { path: '/domicilio', label: 'Domicilio', icon: 'domicilio' },
    { path: '/inventario', label: 'Inventario', icon: 'inventario' },
    { path: '/caja', label: 'Caja', icon: 'caja' },
  ];

  /** Solo aparecen en Más (escritorio y móvil). */
  readonly moreOnlyLinks: NavLink[] = [
    { path: '/lista-precios', label: 'Lista precios', icon: 'lista' },
    { path: '/publicidad', label: 'Publicidad', icon: 'publicidad' },
  ];

  /** Móvil: resto de secciones + lista/publicidad. */
  readonly moreLinks: NavLink[] = [
    { path: '/entradas', label: 'Entradas', icon: 'entradas' },
    { path: '/surtir', label: 'Surtir / Pedido', icon: 'surtir' },
    { path: '/traspasos', label: 'Traspasos', icon: 'traspasos' },
    { path: '/apartados', label: 'Apartados', icon: 'apartados' },
    { path: '/inversion', label: 'Inversión', icon: 'inversion' },
    { path: '/precios', label: 'Histórico precios', icon: 'precios' },
    { path: '/uso-casa', label: 'Uso en casa', icon: 'uso-casa' },
    { path: '/lista-precios', label: 'Lista precios', icon: 'lista' },
    { path: '/publicidad', label: 'Publicidad', icon: 'publicidad' },
  ];

  masAbierto = false;
  esLogin = false;
  usuarioActual: string | null = null;
  enLinea = true;
  pendientes = 0;
  sincronizando = false;
  offlineMsg = '';
  offlineBanner = false;

  pwdDialogAbierto = false;
  pwdActual = '';
  pwdNueva = '';
  pwdError = '';
  pwdCargando = false;

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
  private offlineSubs: Subscription[] = [];
  private lastRenew = 0;
  /** Renueva en servidor como máximo cada 25 s si hay movimiento. */
  private readonly renewMs = 25_000;
  private onActividad = (): void => this.renovarSiHayActividad();
  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      // Teclado abierto sin “Ir”: al salir/volver no deje sticky encima del menú.
      this.blurCampoActivo();
      return;
    }
    if (document.visibilityState === 'visible') {
      this.lastRenew = 0;
      this.renovarSiHayActividad();
    }
  };

  /** Cierra teclado móvil para que sticky/bottom-nav no se peleen. */
  private blurCampoActivo(): void {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) {
      el.blur();
    }
  }

  get sesionActiva(): boolean {
    return !!this.usuarioActual;
  }

  get pullVisible(): boolean {
    return this.pullDistancia > 8;
  }

  get masActivo(): boolean {
    return this.masLinksVista.some((l) => this.router.url.startsWith(l.path));
  }

  /** En móvil el sheet trae todas las secciones secundarias; en escritorio solo Lista y Publicidad. */
  get masLinksVista(): NavLink[] {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return this.moreLinks;
    }
    return this.moreOnlyLinks;
  }

  private irALogin(): void {
    this.esLogin = true;
    const path = (this.router.url || '').split('?')[0];
    if (path === '/login' || path.startsWith('/login/')) return;
    void this.router.navigateByUrl('/login');
  }

  constructor(
    private router: Router,
    private pullRefresh: PullRefreshService,
    private auth: AuthService,
    private offline: OfflineService,
    private api: ApiService
  ) {
    this.actualizarEsLogin(this.router.url);
    this.usuarioActual = this.auth.usuario;
    this.enLinea = this.offline.online;
    // Suscribir ya en constructor: si /me responde antes de AfterViewInit, no perdemos el evento.
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.masAbierto = false;
        this.blurCampoActivo();
        this.actualizarEsLogin(e.urlAfterRedirects || e.url);
        this.scrollActiveNavIntoView();
      });
    this.authSub = this.auth.authChanges$.subscribe((m) => {
      this.usuarioActual = m?.authenticated
        ? m.displayName || m.username || null
        : null;
      if (m?.authenticated) {
        this.esLogin = false;
        this.prefetchParaOffline();
        if (this.offline.online) void this.offline.flush();
      } else if (m && !m.authenticated) {
        this.masAbierto = false;
        this.esLogin = true;
        // Los guards redirigen; aquí solo evitamos el blank “Cargando…” 
        // y no lanzamos otra navegación que cancele /login.
        const path = (this.router.url || '').split('?')[0];
        if (path !== '/login' && !path.startsWith('/login/')) {
          void this.router.navigateByUrl('/login');
        }
      }
    });
    this.offlineSubs.push(
      this.offline.online$.subscribe((v) => {
        this.enLinea = v;
        this.offlineBanner = !v;
        if (v) void this.offline.flush();
      }),
      this.offline.pendingCount$.subscribe((n) => (this.pendientes = n)),
      this.offline.syncing$.subscribe((v) => (this.sincronizando = v)),
      this.offline.lastMessage$.subscribe((m) => {
        this.offlineMsg = m;
        if (m) {
          window.setTimeout(() => {
            if (this.offlineMsg === m && this.enLinea && this.pendientes === 0) {
              this.offlineMsg = '';
            }
          }, 6000);
        }
      })
    );
    // Valida sesión al cargar; los guards hacen el redirect.
    this.auth.me({ force: true }).subscribe();
  }

  sincronizarAhora(): void {
    void this.offline.flush();
  }

  /** Cachea datos clave para poder operar sin red (todos los usuarios). */
  private prefetchParaOffline(): void {
    if (!this.offline.online) return;
    const ignore = { error: () => undefined };
    this.api.inventario().subscribe(ignore);
    this.api.ventas().subscribe(ignore);
    this.api.usoCasa().subscribe(ignore);
    this.api.entradas().subscribe(ignore);
    this.api.traspasos().subscribe(ignore);
    this.api.personas().subscribe(ignore);
    this.api.apartados().subscribe(ignore);
    this.api.caja().subscribe(ignore);
    this.api.producciones().subscribe(ignore);
    this.api.recetas().subscribe(ignore);
    this.api.ajustesInventario().subscribe(ignore);
    this.api.pedidos().subscribe(ignore);
    this.api.pedidosAbiertos().subscribe(ignore);
    this.api.inversion().subscribe(ignore);
    this.api.precios().subscribe(ignore);
    this.api.margenes().subscribe(ignore);
  }

  ngAfterViewInit(): void {
    this.mainEl = this.mainRef?.nativeElement ?? null;
    document.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', this.onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true, capture: true });
    document.addEventListener('pointerdown', this.onActividad, { capture: true, passive: true });
    document.addEventListener('keydown', this.onActividad, { capture: true, passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.mainEl?.addEventListener('scroll', this.onMainScroll, { passive: true });

    this.actualizarEsLogin(this.router.url);
    queueMicrotask(() => this.scrollActiveNavIntoView());
  }

  ngOnDestroy(): void {
    document.removeEventListener('wheel', this.onWheel, true);
    document.removeEventListener('touchstart', this.onTouchStart, true);
    document.removeEventListener('touchmove', this.onTouchMove, true);
    document.removeEventListener('touchend', this.onTouchEnd, true);
    document.removeEventListener('touchcancel', this.onTouchCancel, true);
    document.removeEventListener('pointerdown', this.onActividad, true);
    document.removeEventListener('keydown', this.onActividad, true);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.mainEl?.removeEventListener('scroll', this.onMainScroll);
    this.routerSub?.unsubscribe();
    this.authSub?.unsubscribe();
    for (const s of this.offlineSubs) s.unsubscribe();
  }

  private onMainScroll = (): void => {
    this.onActividad();
  };

  private renovarSiHayActividad(): void {
    if (this.esLogin || !this.auth.autenticado || !this.enLinea) return;
    const now = Date.now();
    if (now - this.lastRenew < this.renewMs) return;
    this.lastRenew = now;
    this.auth.renovarSesion();
  }

  private actualizarEsLogin(url: string): void {
    const path = (url || '').split('?')[0];
    this.esLogin = path === '/login' || path.startsWith('/login/');
  }

  toggleMas(): void {
    const abrir = !this.masAbierto;
    if (abrir) this.blurCampoActivo();
    this.masAbierto = abrir;
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

  abrirCambioPassword(): void {
    this.pwdActual = '';
    this.pwdNueva = '';
    this.pwdError = '';
    this.pwdDialogAbierto = true;
    this.masAbierto = false;
  }

  cerrarCambioPassword(): void {
    this.pwdDialogAbierto = false;
    this.pwdActual = '';
    this.pwdNueva = '';
    this.pwdError = '';
  }

  enviarCambioPassword(): void {
    this.pwdError = '';
    if (!this.pwdActual || !this.pwdNueva) {
      this.pwdError = 'Escribe la contraseña actual y la nueva';
      return;
    }
    if (this.pwdNueva.length < 8) {
      this.pwdError = 'La nueva contraseña debe tener al menos 8 caracteres';
      return;
    }
    this.pwdCargando = true;
    this.auth.cambiarPassword(this.pwdActual, this.pwdNueva).subscribe({
      next: () => {
        this.pwdCargando = false;
        this.cerrarCambioPassword();
      },
      error: (err) => {
        this.pwdCargando = false;
        const body = err?.error;
        const msg =
          (typeof body === 'object' && body?.error) ||
          (typeof body === 'string' ? body : null) ||
          err?.message;
        this.pwdError =
          typeof msg === 'string' && msg.length < 160 ? msg : 'No se pudo cambiar la contraseña';
      },
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
    const t = ev.target;
    if (
      t instanceof Element &&
      t.closest('input, textarea, select, [contenteditable="true"], .sugerencias, .producto-ac-sugerencias, [role="dialog"]')
    ) {
      return;
    }
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
    // No refrescar si el usuario está escribiendo (teclado abierto).
    if (capturaTieneFocoEnCampo()) {
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

    const main = this.mainRef?.nativeElement ?? this.mainEl;
    if (!main || e.ctrlKey) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (
      target.closest(
        '.overlay, [role="dialog"], .cal-pop, app-confirm-dialog, .sugerencias, .producto-ac-sugerencias, .mas-sheet'
      )
    ) {
      return;
    }

    const nested = target.closest('.table-wrap, .ticket') as HTMLElement | null;
    if (nested && main.contains(nested)) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const style = getComputedStyle(nested);
      const oy = style.overflowY;
      const scrollsY = oy === 'auto' || oy === 'scroll' || oy === 'overlay';
      const canY = scrollsY && nested.scrollHeight > nested.clientHeight + 1;
      if (!canY) {
        const prev = main.scrollTop;
        main.scrollTop += e.deltaY;
        if (main.scrollTop !== prev) e.preventDefault();
        return;
      }

      const atTop = nested.scrollTop <= 0;
      const atBottom = nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        const prev = main.scrollTop;
        main.scrollTop += e.deltaY;
        if (main.scrollTop !== prev) e.preventDefault();
      }
      return;
    }

    if (!main.contains(target)) {
      const prev = main.scrollTop;
      main.scrollTop += e.deltaY;
      if (main.scrollTop !== prev) e.preventDefault();
    }
  };
}
