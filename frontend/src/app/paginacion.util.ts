/** Tamaño de página según viewport (móvil más corto). */
export function pageSizeDefault(movil = 12, escritorio = 25): number {
  if (typeof window === 'undefined') return escritorio;
  return window.matchMedia('(max-width: 767px)').matches ? movil : escritorio;
}

/** Filas vacías al capturar lote: 1 en móvil, 2 en PC. */
export function capturaLineasVacias(movil = 1, escritorio = 2): number {
  if (typeof window === 'undefined') return escritorio;
  return window.matchMedia('(max-width: 767px)').matches ? movil : escritorio;
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
