/**
 * Utilidades compartidas de captura (focus / scroll / márgenes en pesos enteros).
 */

/** Control realmente a la vista (ignora la tabla oculta en móvil). */
export function elementoVisible(el: HTMLElement | null | undefined): boolean {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

export function esMovilTactil(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Layout móvil (CSS) o puntero grueso. */
export function capturaEsLayoutMovil(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 767px)').matches || esMovilTactil())
  );
}

/**
 * Altura “llena” vista en la sesión. En Android Chrome a veces el layout
 * (innerHeight) también se encoge con el teclado; sin este techo el shrink
 * sale 0 y nunca compactamos el sticky.
 */
let capturaViewportMax = 0;

export function capturaResetViewportMax(): void {
  capturaViewportMax = 0;
}

function capturaSampleViewportMax(): void {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  const ih = window.innerHeight || 0;
  const vh = vv && vv.height > 0 ? vv.height : ih;
  capturaViewportMax = Math.max(capturaViewportMax, ih, vh);
}

/** Teclado virtual abierto (vv o layout más bajos que el máximo visto). */
export function capturaTecladoAbierto(minShrinkPx = 140): boolean {
  if (typeof window === 'undefined') return false;
  const vv = window.visualViewport;
  const ih = window.innerHeight || 0;
  const vh = vv && vv.height > 0 ? vv.height : ih;
  if (ih < 1 && vh < 1) return false;

  const ae = document.activeElement;
  const escribiendo =
    ae instanceof HTMLInputElement ||
    ae instanceof HTMLTextAreaElement ||
    (ae instanceof HTMLElement && ae.isContentEditable);

  // Sin foco de captura: actualizar techo y no asumir teclado.
  if (!escribiendo) {
    capturaSampleViewportMax();
    return ih - vh >= minShrinkPx;
  }

  // Con foco: no subir el techo (la altura ya puede incluir teclado).
  if (capturaViewportMax < 1) capturaSampleViewportMax();
  if (capturaViewportMax - vh >= minShrinkPx) return true;
  if (ih - vh >= minShrinkPx) return true;
  return false;
}

/**
 * Escucha visualViewport para compactar sticky al abrir teclado.
 * Devuelve cleanup.
 */
export function observarTecladoCaptura(
  onChange: (abierto: boolean) => void,
  minShrinkPx = 140
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  capturaSampleViewportMax();
  let abierto = capturaTecladoAbierto(minShrinkPx);
  const tick = () => {
    const next = capturaTecladoAbierto(minShrinkPx);
    if (next === abierto) return;
    abierto = next;
    onChange(abierto);
  };
  const vv = window.visualViewport;
  window.addEventListener('resize', tick);
  window.addEventListener('orientationchange', () => {
    capturaResetViewportMax();
    capturaSampleViewportMax();
    tick();
  });
  if (vv) {
    vv.addEventListener('resize', tick);
    vv.addEventListener('scroll', tick);
  }
  onChange(abierto);
  return () => {
    window.removeEventListener('resize', tick);
    if (vv) {
      vv.removeEventListener('resize', tick);
      vv.removeEventListener('scroll', tick);
    }
  };
}

/** Foco dentro de una línea/ticket de captura (producto, cantidad…). */
export function focoEnCapturaLinea(el: Element | null = document.activeElement): boolean {
  return !!(el instanceof HTMLElement && el.closest('.linea-card, .ticket, .producto-ac'));
}

/** Contenedor de scroll de la app (evita pelear con body overflow:hidden). */
export function mainScrollEl(): HTMLElement | null {
  return (
    (document.querySelector('main.app-main') as HTMLElement | null) ||
    (document.querySelector('.app-shell main') as HTMLElement | null) ||
    (document.querySelector('main') as HTMLElement | null)
  );
}

/**
 * Franja útil real encima del teclado y debajo del chrome fijo/sticky.
 * Usa getBoundingClientRect (incluye header Amorcas + ventas-fijo), no solo
 * la altura del sticky dentro de main — eso mandaba el campo “muy arriba”.
 */
export function franjaVisibleCaptura(): { top: number; bottom: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const layoutTop = 0;
  const layoutBottom =
    vv && vv.height > 0 ? vv.offsetTop + vv.height : typeof window !== 'undefined' ? window.innerHeight : 800;
  const vvTop = vv ? vv.offsetTop : 0;

  let top = Math.max(layoutTop, vvTop);
  const selectors =
    'header.top, .ventas-fijo, .dom-fijo, .captura-head, .captura-sticky-top, .traspasos-fijo, .entradas-fijo';
  document.querySelectorAll<HTMLElement>(selectors).forEach((el) => {
    if (!el.isConnected) return;
    const st = getComputedStyle(el).position;
    if (st !== 'fixed' && st !== 'sticky') return;
    // Oculto (p. ej. body.captura-teclado) → no cuenta.
    const r = el.getBoundingClientRect();
    if (r.height < 2 || r.width < 2) return;
    // Solo chrome que tapa la parte alta de la franja visual.
    if (r.bottom <= vvTop + 2) return;
    if (r.top > vvTop + (vv?.height ?? 0) * 0.55) return;
    top = Math.max(top, r.bottom);
  });

  return { top: top + 6, bottom: layoutBottom - 10 };
}

/** @deprecated preferir franjaVisibleCaptura */
export function stickyTopInset(main?: HTMLElement | null): number {
  const band = franjaVisibleCaptura();
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const base = vv ? vv.offsetTop : 0;
  return Math.max(0, band.top - base - 6);
}

function usarScrollBanda(): boolean {
  return capturaEsLayoutMovil() || capturaTecladoAbierto(80);
}

/**
 * Lleva un elemento a la vista scrolleando el main (no el body).
 *
 * prefer:
 * - min: solo lo necesario para entrar en la franja
 * - upper: cerca del borde superior de la franja (cantidad)
 * - comfort: un poco abajo del sticky (tras cerrar teclado)
 */
export function scrollEnMain(
  el: HTMLElement | null | undefined,
  opts?: {
    offset?: number;
    belowSticky?: boolean;
    pinTop?: boolean;
    comfort?: boolean;
    prefer?: 'min' | 'upper' | 'comfort';
  }
): void {
  if (!el) return;
  const main = mainScrollEl();
  const prefer: 'min' | 'upper' | 'comfort' =
    opts?.prefer ?? (opts?.comfort ? 'comfort' : opts?.pinTop ? 'upper' : 'min');

  if (main && usarScrollBanda()) {
    const r = el.getBoundingClientRect();
    const { top: visibleTop, bottom: visibleBottom } = franjaVisibleCaptura();
    const zona = Math.max(48, visibleBottom - visibleTop);

    if (prefer === 'min' && r.top >= visibleTop - 2 && r.bottom <= visibleBottom + 2) {
      return;
    }

    let targetTop = visibleTop;
    if (prefer === 'comfort') {
      targetTop = visibleTop + Math.min(36, zona * 0.14);
    } else if (prefer === 'upper') {
      targetTop = visibleTop + Math.min(10, zona * 0.04);
    } else {
      // min: si sobresale abajo, subir; si sobresale arriba, bajar.
      let delta = 0;
      if (r.bottom > visibleBottom) delta = r.bottom - visibleBottom;
      if (r.top - delta < visibleTop) delta = r.top - visibleTop;
      if (Math.abs(delta) < 2) return;
      main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'auto' });
      return;
    }

    let delta = r.top - targetTop;
    // Si tras mover el fondo sigue bajo el teclado y el campo cabe, prioriza ver el fondo.
    if (r.height <= zona && r.bottom - delta > visibleBottom) {
      delta = r.bottom - visibleBottom;
      if (r.top - delta < visibleTop) delta = r.top - visibleTop;
    }
    if (Math.abs(delta) < 2) return;
    main.scrollTo({
      top: Math.max(0, main.scrollTop + delta),
      behavior: prefer === 'comfort' ? 'smooth' : 'auto',
    });
    return;
  }

  if (main) {
    const sticky = opts?.belowSticky === false ? 0 : stickyTopInset(main);
    const offset = opts?.offset ?? sticky + 24;
    const r = el.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const y = main.scrollTop + (r.top - mainRect.top) - offset;
    main.scrollTo({
      top: Math.max(0, y),
      behavior: prefer === 'comfort' ? 'smooth' : 'auto',
    });
    return;
  }

  el.scrollIntoView({
    block: prefer === 'comfort' ? 'start' : 'nearest',
    behavior: prefer === 'comfort' ? 'smooth' : 'auto',
  });
}

/** Al cerrar teclado: ancla la línea de captura en posición cómoda. */
export function scrollLineaCapturaComfort(el: HTMLElement | null | undefined): void {
  scrollEnMain(el, { belowSticky: true, prefer: 'comfort' });
}

/**
 * Enfocar/scroll tras pintar DOM.
 * Móvil: reintentos cuando abre el teclado (visualViewport); sin ellos cantidad queda abajo.
 */
export function programarEnfoque(fn: () => void): void {
  setTimeout(fn, 50);
  setTimeout(fn, esMovilTactil() || capturaTecladoAbierto(80) ? 200 : 220);
  if (esMovilTactil() || capturaTecladoAbierto(80)) {
    setTimeout(fn, 420);
  }
}

/**
 * Lleva un campo de captura a la zona visible (bajo chrome, sobre teclado).
 * - soft (default): mínimo
 * - forceTop: cerca del borde superior de la franja útil (cantidad)
 *   En producto: ancla en `.linea-top` para ver el nº de línea y el texto "Producto".
 */
export function scrollCampoCaptura(
  el: HTMLElement | null | undefined,
  opts?: { forceTop?: boolean }
): void {
  if (!el) return;
  let ancla: HTMLElement =
    (el.closest('.campo-cantidad, .campo, label.campo, .producto-campo') as HTMLElement | null) ||
    el;
  if (opts?.forceTop && ancla.classList.contains('producto-campo')) {
    const cab =
      (el.closest('.linea-card')?.querySelector('.linea-top') as HTMLElement | null) ||
      (el.closest('.linea-card') as HTMLElement | null);
    if (cab) ancla = cab;
  }
  scrollEnMain(ancla, {
    belowSticky: true,
    prefer: opts?.forceTop ? 'upper' : 'min',
  });
}

export function enfocarInput(el: HTMLInputElement | null | undefined): boolean {
  if (!el || !elementoVisible(el)) return false;
  el.focus({ preventScroll: true });
  if (!esMovilTactil()) el.select();
  return true;
}

export function enfocarPorAttr(attr: string, valor: string | number): boolean {
  const nodos = document.querySelectorAll<HTMLElement>(`[${attr}="${valor}"]`);
  for (const node of Array.from(nodos)) {
    if (!elementoVisible(node)) continue;
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.focus({ preventScroll: true });
      if (!esMovilTactil()) node.select();
      return true;
    }
    node.focus();
    return true;
  }
  return false;
}

export function scrollLineaPorAttr(attr: string, valor: string | number): void {
  const nodos = document.querySelectorAll<HTMLElement>(`[${attr}="${valor}"]`);
  for (const node of Array.from(nodos)) {
    if (!elementoVisible(node) && !node.isConnected) continue;
    const ancla =
      (node.querySelector('app-producto-autocomplete input') as HTMLElement | null) || node;
    scrollEnMain(ancla);
    return;
  }
}

export function precioConMargenEntero(base: number, pct: number): number {
  const b = Number(base);
  const p = Number(pct);
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(p)) return 0;
  return Math.round(b * (1 + p / 100));
}

/** Mayoreo: descuento % sobre menudeo, en pesos enteros. */
export function precioConDescuentoEntero(menudeo: number, pctDescuento: number): number {
  const b = Number(menudeo);
  const p = Number(pctDescuento);
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(p)) return 0;
  return Math.round(b * (1 - p / 100));
}

/** No permitir precio por debajo de la compra (mayoreo entero ≥ techo de compra). */
export function noBajoCompra(precio: number, compra: number): number {
  const p = Number(precio);
  const c = Number(compra);
  if (!Number.isFinite(p)) return 0;
  if (!Number.isFinite(c) || c <= 0) return p;
  const piso = Math.ceil(c - 1e-9);
  return Math.max(p, piso);
}

/** @deprecated usar precioConMargenEntero */
export function precioConMargenArriba(base: number, pct: number): number {
  return precioConMargenEntero(base, pct);
}

export function inputsVisiblesDe(
  lista: Iterable<{ nativeElement?: HTMLInputElement } | HTMLInputElement> | null | undefined
): HTMLInputElement[] {
  if (!lista) return [];
  const out: HTMLInputElement[] = [];
  for (const item of Array.from(lista as Iterable<unknown>)) {
    const el =
      item instanceof HTMLInputElement
        ? item
        : (item as { nativeElement?: HTMLInputElement })?.nativeElement;
    if (el instanceof HTMLInputElement && elementoVisible(el)) out.push(el);
  }
  return out;
}

function columnasDeGrid(el: HTMLElement | null): number {
  const grid = el?.closest('.calc-denoms') as HTMLElement | null;
  if (!grid) return 1;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean);
  return Math.max(1, cols.length);
}

/** Enter / flechas entre campos de captura (lista o grilla tipo calculadora). */
export function navegarCampos(
  ev: KeyboardEvent,
  visibles: HTMLInputElement[],
  opts?: { grilla?: boolean; alFinalEnter?: () => void }
): boolean {
  const key = ev.key;
  const t = ev.target;
  if (!(t instanceof HTMLInputElement)) return false;
  if (t.type === 'date' && (key === 'ArrowUp' || key === 'ArrowDown')) return false;
  const i = visibles.indexOf(t);
  if (i < 0) return false;

  let next = i;
  if (opts?.grilla) {
    const cols = columnasDeGrid(t);
    if (key === 'Enter' || key === 'ArrowRight') next = i + 1;
    else if (key === 'ArrowLeft') next = i - 1;
    else if (key === 'ArrowDown') next = i + cols;
    else if (key === 'ArrowUp') next = i - cols;
    else return false;
  } else if (key === 'Enter' || key === 'ArrowDown') {
    next = i + 1;
  } else if (key === 'ArrowUp') {
    next = i - 1;
  } else {
    return false;
  }

  if (next >= 0 && next < visibles.length && next !== i) {
    ev.preventDefault();
    enfocarInput(visibles[next]);
    return true;
  }
  if (next >= visibles.length && (key === 'Enter' || key === 'ArrowDown' || key === 'ArrowRight')) {
    ev.preventDefault();
    opts?.alFinalEnter?.();
    return true;
  }
  if (key === 'Enter') {
    ev.preventDefault();
    return true;
  }
  return false;
}
