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

/** Contenedor de scroll de la app (evita pelear con body overflow:hidden). */
export function mainScrollEl(): HTMLElement | null {
  return (
    (document.querySelector('main.app-main') as HTMLElement | null) ||
    (document.querySelector('.app-shell main') as HTMLElement | null) ||
    (document.querySelector('main') as HTMLElement | null)
  );
}

/** Altura de barras sticky en la parte superior del main (p. ej. `.ventas-fijo`). */
export function stickyTopInset(main?: HTMLElement | null): number {
  const root = main ?? mainScrollEl();
  if (!root) return 0;
  let inset = 0;
  root.querySelectorAll<HTMLElement>('.ventas-fijo, .dom-fijo, .captura-sticky-top').forEach((el) => {
    const st = getComputedStyle(el).position;
    if (st !== 'sticky' && st !== 'fixed') return;
    // Altura completa: al medir antes del scroll la barra aún no está “pegada”.
    const h = el.getBoundingClientRect().height;
    if (h < 2) return;
    inset = Math.max(inset, h);
  });
  return inset;
}

/**
 * Lleva un elemento a la vista scrolleando el main (no el body).
 * En móvil ancla arriba (bajo stickies / visualViewport) para que la card no quede baja.
 */
export function scrollEnMain(
  el: HTMLElement | null | undefined,
  opts?: { offset?: number; belowSticky?: boolean }
): void {
  if (!el) return;
  const main = mainScrollEl();
  const sticky =
    opts?.belowSticky === false ? 0 : stickyTopInset(main);
  let offset = opts?.offset;
  if (offset == null) {
    offset = sticky + (esMovilTactil() ? 10 : 24);
  }
  if (main) {
    const r = el.getBoundingClientRect();
    // Con teclado: anclar al viewport visible, no al layout completo.
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (esMovilTactil() && vv && vv.height > 0) {
      const targetTop = vv.offsetTop + sticky + 8;
      const delta = r.top - targetTop;
      main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: 'auto' });
      return;
    }
    const mainRect = main.getBoundingClientRect();
    const y = main.scrollTop + (r.top - mainRect.top) - offset;
    main.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    return;
  }
  el.scrollIntoView({
    block: esMovilTactil() ? 'start' : 'center',
    behavior: 'auto',
  });
}

/** Un intento en móvil (el segundo pelea con el teclado); dos en escritorio (DOM nuevo). */
export function programarEnfoque(fn: () => void): void {
  setTimeout(fn, 50);
  if (!esMovilTactil()) {
    setTimeout(fn, 220);
  }
}

export function enfocarInput(el: HTMLInputElement | null | undefined): boolean {
  if (!el || !elementoVisible(el)) return false;
  el.focus({ preventScroll: true });
  // select() en móvil a veces cierra/reabre el teclado virtual
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
