/** Control realmente a la vista (ignora la tabla oculta en móvil). */
export function elementoVisible(el: HTMLElement | null | undefined): boolean {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

export function esMovilTactil(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
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
    if (!elementoVisible(node)) continue;
    // Preferir el input producto dentro de la fila (móvil + teclado).
    const ancla =
      (node.querySelector('app-producto-autocomplete input') as HTMLElement | null) || node;
    // nearest + auto: smooth/center pelea con el teclado virtual en móvil
    ancla.scrollIntoView({
      block: esMovilTactil() ? 'nearest' : 'center',
      behavior: esMovilTactil() ? 'auto' : 'smooth',
    });
    return;
  }
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
