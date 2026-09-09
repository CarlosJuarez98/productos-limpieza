import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mainScroll', { static: true }) mainRef!: ElementRef<HTMLElement>;

  readonly links = [
    { path: '/ventas', label: 'Ventas' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/entradas', label: 'Entrada de proveedor' },
    { path: '/uso-casa', label: 'Uso en casa' },
    { path: '/traspasos', label: 'Traspasos' },
    { path: '/caja', label: 'Caja' },
    { path: '/apartados', label: 'Apartados' },
    { path: '/inversion', label: 'Inversión' },
    { path: '/precios', label: 'Histórico precios' },
    { path: '/lista-precios', label: 'Lista precios' },
  ];

  /** Pull-to-refresh (móvil). */
  pullDistancia = 0;
  pullListo = false;
  private pullInicioY: number | null = null;
  private pullActivo = false;
  private readonly pullUmbral = 78;

  private mainEl: HTMLElement | null = null;

  get pullVisible(): boolean {
    return this.pullDistancia > 8;
  }

  ngAfterViewInit(): void {
    this.mainEl = this.mainRef.nativeElement;
    document.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', this.onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true, capture: true });
  }

  ngOnDestroy(): void {
    document.removeEventListener('wheel', this.onWheel, true);
    document.removeEventListener('touchstart', this.onTouchStart, true);
    document.removeEventListener('touchmove', this.onTouchMove, true);
    document.removeEventListener('touchend', this.onTouchEnd, true);
    document.removeEventListener('touchcancel', this.onTouchCancel, true);
  }

  private onTouchStart = (ev: TouchEvent): void => {
    if (ev.touches.length !== 1) return;
    if (!this.contenidoEnTope(ev.target)) {
      this.pullInicioY = null;
      return;
    }
    this.pullInicioY = ev.touches[0].clientY;
    this.pullActivo = true;
    this.pullDistancia = 0;
    this.pullListo = false;
  };

  private onTouchMove = (ev: TouchEvent): void => {
    if (!this.pullActivo || this.pullInicioY == null || ev.touches.length !== 1) return;
    if (!this.contenidoEnTope(ev.target)) {
      this.resetPull();
      return;
    }
    const dy = ev.touches[0].clientY - this.pullInicioY;
    if (dy <= 0) {
      this.resetPull();
      return;
    }
    this.pullDistancia = Math.min(120, dy * 0.55);
    this.pullListo = this.pullDistancia >= this.pullUmbral;
    if (this.pullDistancia > 20) {
      ev.preventDefault();
    }
  };

  private onTouchEnd = (): void => {
    if (!this.pullActivo) return;
    const recargar = this.pullListo;
    this.resetPull();
    if (recargar) {
      window.location.reload();
    }
  };

  private onTouchCancel = (): void => {
    this.resetPull();
  };

  private resetPull(): void {
    this.pullActivo = false;
    this.pullInicioY = null;
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
   * - Lados / fuera de tabla → scroll general (main)
   * - Dentro de .table-wrap → scroll de la tabla; al borde o sin overflow Y → main
   */
  private onWheel = (e: WheelEvent): void => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const main = this.mainEl;
    if (!main || e.ctrlKey) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('.overlay, [role="dialog"], app-confirm-dialog')) return;

    const wrap = target.closest('.table-wrap') as HTMLElement | null;
    if (wrap && main.contains(wrap)) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const oy = getComputedStyle(wrap).overflowY;
      const scrollsY = oy === 'auto' || oy === 'scroll' || oy === 'overlay';
      if (!scrollsY) return;

      const canY = wrap.scrollHeight > wrap.clientHeight + 1;
      if (!canY) {
        e.preventDefault();
        main.scrollTop += e.deltaY;
        return;
      }

      const atTop = wrap.scrollTop <= 0;
      const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 1;
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
