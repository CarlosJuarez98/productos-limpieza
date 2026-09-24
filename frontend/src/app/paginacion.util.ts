/** Tamaño de página según viewport (móvil más corto). */
export function pageSizeDefault(movil = 12, escritorio = 25): number {
  if (typeof window === 'undefined') return escritorio;
  return window.matchMedia('(max-width: 767px)').matches ? movil : escritorio;
}

/** Teléfono / tablet: misma regla que las grillas de cards (≤1024px). */
export function capturaEsMovil(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1024px)').matches;
}

/** Filas vacías al capturar lote: 1 en móvil/tablet, 2 en PC. */
export function capturaLineasVacias(movil = 1, escritorio = 2): number {
  if (typeof window === 'undefined') return escritorio;
  return capturaEsMovil() ? movil : escritorio;
}

/**
 * Conserva líneas con datos y rellena vacías hasta el mínimo del viewport.
 * Reusa las vacías existentes (mismas keys) para no destruir el input enfocado
 * cuando Android dispara resize al abrir el teclado.
 */
export function alinearLineasCaptura<T>(
  lineas: T[],
  esVacia: (l: T) => boolean,
  crear: () => T
): T[] {
  const objetivo = capturaLineasVacias();
  const llenas = lineas.filter((l) => !esVacia(l));
  const vacias = lineas.filter((l) => esVacia(l));
  const out = [...llenas];
  let vi = 0;
  while (out.length < objetivo) {
    out.push(vi < vacias.length ? vacias[vi++] : crear());
  }
  // Misma cantidad y mismas refs → no reasignar (evita CD innecesario).
  if (out.length === lineas.length && out.every((l, i) => l === lineas[i])) {
    return lineas;
  }
  return out.length ? out : vacias[0] ? [vacias[0]] : [crear()];
}

/**
 * true solo si cambió móvil↔PC. El teclado Android dispara resize por altura
 * sin cambiar el breakpoint; realinear ahí mata el foco y cierra el teclado.
 */
export function capturaBreakpointCambio(prevMovil: boolean): {
  cambio: boolean;
  movil: boolean;
} {
  const movil = capturaEsMovil();
  return { cambio: movil !== prevMovil, movil };
}

/** true si el usuario está escribiendo (no realinear / no pelear con el teclado). */
export function capturaTieneFocoEnCampo(): boolean {
  if (typeof document === 'undefined') return false;
  const a = document.activeElement;
  return (
    a instanceof HTMLInputElement ||
    a instanceof HTMLTextAreaElement ||
    a instanceof HTMLSelectElement ||
    (a instanceof HTMLElement && a.isContentEditable)
  );
}

/** Estado de paginación sobre un arreglo ya filtrado. */
export class PaginacionEstado<T> {
  items: T[] = [];
  pagina = 1;

  constructor(readonly pageSize: number = pageSizeDefault()) {}

  setItems(items: T[], reset = false): void {
    this.items = items ?? [];
    if (reset) this.pagina = 1;
    if (this.pagina > this.totalPaginas) this.pagina = this.totalPaginas;
  }

  get total(): number {
    return this.items.length;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get paginaItems(): T[] {
    const start = (this.pagina - 1) * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }

  get desde(): number {
    if (!this.total) return 0;
    return (this.pagina - 1) * this.pageSize + 1;
  }

  get hasta(): number {
    return Math.min(this.pagina * this.pageSize, this.total);
  }

  get mostrar(): boolean {
    return this.total > this.pageSize;
  }

  ir(p: number): boolean {
    if (p < 1 || p > this.totalPaginas || p === this.pagina) return false;
    this.pagina = p;
    return true;
  }

  anterior(): boolean {
    return this.ir(this.pagina - 1);
  }

  siguiente(): boolean {
    return this.ir(this.pagina + 1);
  }
}
