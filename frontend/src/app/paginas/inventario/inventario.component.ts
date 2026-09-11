import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { ClearableDirective } from '../../clearable.directive';
import { AjusteInventario, InventarioItem, MargenConfig } from '../../modelos';
import { PullRefreshService } from '../../pull-refresh.service';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { compararNombreNatural } from '../../nombre-natural.util';
import { AutoHideDirective } from '../../auto-hide.directive';

type FormProducto = {
  nombre: string;
  precioCompra: number | null;
  /** Alta: lo que pagaste por el lote (ej. 3 piezas en $10 → total 10). */
  totalPagado: number | null;
  cantidadInicial: number | null;
  precioVenta: number | null;
  precioMayoreo5: number | null;
  precioMayoreo10: number | null;
  vendePor: 'LITROS' | 'PIEZA';
};

type FormAjuste = {
  fecha: string;
  productoId: number | null;
  /** Cantidad en la que debe quedar el stock; el delta se calcula solo. */
  stockDeseado: number | null;
  motivo: string;
};

type ColKey =
  | 'producto'
  | 'vende'
  | 'menudeo'
  | 'm5'
  | 'm10'
  | 'compra'
  | 'minSug'
  | 'maxSug'
  | 'stock'
  | 'ganancia';

type ColDef = { key: ColKey; label: string; fijo?: boolean };

const COLS_STORAGE = 'pl.inventario.columnas.v2';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ClearableDirective,
    PaginadorComponent,
    FechaDmYPipe,
    AutoHideDirective,
  ],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss',
})
export class InventarioComponent implements OnInit, OnDestroy {
  @ViewChild('listaResultados') listaResultados?: ElementRef<HTMLElement>;

  items: InventarioItem[] = [];
  /** Resultados filtrados (cache; no recalcular en cada CD). */
  filtrados: InventarioItem[] = [];
  filtro = '';
  /** Texto del buscador; el filtro de lista se aplica con debounce. */
  filtroTexto = '';
  listaAbierta = true;
  /** Historial de ajustes: cerrado hasta que lo abran. */
  ajusteAbierto = false;
  altaAbierta =
    typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches;
  error = '';
  ok = '';
  errorAjuste = '';
  okAjuste = '';
  guardandoMargen = false;
  guardandoAjuste = false;
  editando: InventarioItem | null = null;
  menuColumnas = false;
  menuMargenes = false;
  pag = new PaginacionEstado<InventarioItem>();
  pagAjustes = new PaginacionEstado<AjusteInventario>(10);
  ajustes: AjusteInventario[] = [];
  editandoAjuste: AjusteInventario | null = null;
  formAjuste: FormAjuste = this.formAjusteVacio();
  /** Ajuste abierto bajo la fila del producto (sin bajar al panel). */
  ajusteEnFila = false;
  /** Motivos fijos de ajuste de stock. */
  readonly motivosAjuste = ['Conteo físico', 'Derrame', 'Merma'] as const;
  private pullSub?: Subscription;
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;
  readonly columnas: ColDef[] = [
    { key: 'producto', label: 'Producto', fijo: true },
    { key: 'menudeo', label: 'Menudeo', fijo: true },
    { key: 'stock', label: 'Stock', fijo: true },
    { key: 'vende', label: 'Se vende' },
    { key: 'm5', label: '≥ 5 L' },
    { key: 'm10', label: '≥ 10 L' },
    { key: 'compra', label: 'Compra' },
    { key: 'minSug', label: 'Mín. sugerido' },
    { key: 'maxSug', label: 'Máx. sugerido' },
    { key: 'ganancia', label: '% ganancia' },
  ];

  get columnasOpcionales(): ColDef[] {
    return this.columnas.filter((c) => !c.fijo);
  }
  visible: Record<ColKey, boolean> = this.defaultsVisibles();
  margen: MargenConfig = {
    margenMin: 0.465,
    margenMax: 0.63,
    margenMayoreo5: 0.4,
    margenMayoreo10: 0.3,
    porcentajeMin: 46.5,
    porcentajeMax: 63,
    porcentajeMayoreo5: 40,
    porcentajeMayoreo10: 30,
  };
  pct = {
    min: 46.5,
    max: 63,
    mayoreo5: 40,
    mayoreo10: 30,
  };
  /** Formulario de alta (arriba). */
  formAlta: FormProducto = this.formVacio();
  /** Formulario de edición en la fila. */
  form: FormProducto = this.formVacio();

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private pullRefresh: PullRefreshService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarVisibles();
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
  }

  @HostListener('document:click')
  cerrarMenus(): void {
    this.menuColumnas = false;
    this.menuMargenes = false;
  }

  private defaultsVisibles(): Record<ColKey, boolean> {
    return {
      producto: true,
      menudeo: true,
      stock: true,
      vende: false,
      m5: false,
      m10: false,
      compra: false,
      minSug: false,
      maxSug: false,
      ganancia: false,
    };
  }

  private cargarVisibles(): void {
    try {
      const raw = localStorage.getItem(COLS_STORAGE);
      if (!raw) {
        this.visible = this.defaultsVisibles();
        return;
      }
      const saved = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      this.visible = {
        ...this.defaultsVisibles(),
        ...saved,
        producto: true,
        menudeo: true,
        stock: true,
      };
    } catch {
      this.visible = this.defaultsVisibles();
    }
  }

  private guardarVisibles(): void {
    localStorage.setItem(COLS_STORAGE, JSON.stringify(this.visible));
  }

  col(key: ColKey): boolean {
    const def = this.columnas.find((c) => c.key === key);
    if (def?.fijo) return true;
    return this.visible[key] !== false;
  }

  toggleCol(key: ColKey, event?: Event): void {
    event?.stopPropagation();
    const def = this.columnas.find((c) => c.key === key);
    if (def?.fijo) return;
    this.visible[key] = !this.col(key);
    this.guardarVisibles();
  }

  toggleMenuColumnas(event: Event): void {
    event.stopPropagation();
    this.menuMargenes = false;
    this.menuColumnas = !this.menuColumnas;
  }

  toggleMenuMargenes(event: Event): void {
    event.stopPropagation();
    this.menuColumnas = false;
    this.menuMargenes = !this.menuMargenes;
  }

  /** Columnas de datos visibles + acciones al final. */
  get colspanEdicion(): number {
    return this.columnas.filter((c) => this.col(c.key)).length + 1;
  }

  get colsDatosVisibles(): number {
    return this.columnas.filter((c) => this.col(c.key)).length;
  }

  /** Incluye la columna de botones (acciones) en el reparto. */
  get colsTabla(): number {
    return this.colsDatosVisibles + 1;
  }

  private formVacio(): FormProducto {
    return {
      nombre: '',
      precioCompra: null,
      totalPagado: null,
      cantidadInicial: null,
      precioVenta: null,
      precioMayoreo5: null,
      precioMayoreo10: null,
      vendePor: 'LITROS',
    };
  }

  private hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Si el motivo guardado no está en la lista (ajustes viejos), mostrarlo al editar. */
  motivoAjusteExtra(): boolean {
    const m = (this.formAjuste.motivo || '').trim();
    return !!m && !(this.motivosAjuste as readonly string[]).includes(m);
  }

  private formAjusteVacio(): FormAjuste {
    return {
      fecha: this.hoyLocal(),
      productoId: null,
      stockDeseado: null,
      motivo: '',
    };
  }

  stockDe(productoId: number | null): number | null {
    if (productoId == null) return null;
    const p = this.items.find((i) => i.id === productoId);
    return p ? Number(p.stockActual) : null;
  }

  /** Stock “antes” de este ajuste (al editar se revierte el delta guardado). */
  stockBaseAjuste(): number | null {
    const actual = this.stockDe(this.formAjuste.productoId);
    if (actual == null) return null;
    if (!this.editandoAjuste) return actual;
    return Math.round((actual - Number(this.editandoAjuste.cantidad)) * 100) / 100;
  }

  unidadAjuste(productoId: number | null): string {
    if (productoId == null) return '';
    const p = this.items.find((i) => i.id === productoId);
    if (!p) return '';
    return this.esPieza(p) ? 'pza' : 'L';
  }

  /** Delta que se enviará: deseado − stock base (suma o resta sola). */
  cantidadAjusteCalculada(): number | null {
    const deseado = Number(this.formAjuste.stockDeseado);
    const base = this.stockBaseAjuste();
    if (!Number.isFinite(deseado) || base == null) return null;
    const delta = Math.round((deseado - base) * 100) / 100;
    return delta === 0 ? null : delta;
  }

  onProductoAjusteChange(productoId: number | null): void {
    this.formAjuste.productoId = productoId;
    if (!this.editandoAjuste) {
      // Vacío para que el placeholder muestre el stock actual como pista.
      this.formAjuste.stockDeseado = null;
    }
  }

  /** Pista en «Dejar stock en»: stock actual del producto. */
  pistaStockAjuste(): string {
    const s = this.stockBaseAjuste();
    if (s == null) return 'Cantidad final';
    const u = this.unidadAjuste(this.formAjuste.productoId);
    return `Actual: ${s.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${u ? ' ' + u : ''}`;
  }

  /** ¿Mostrar el formulario de ajuste bajo esta fila/tarjeta? */
  mostrandoAjusteEn(item: InventarioItem): boolean {
    return this.ajusteEnFila && this.formAjuste.productoId === item.id && !this.editandoAjuste;
  }

  private prepAjusteEnFila(item: InventarioItem): void {
    this.editandoAjuste = null;
    this.formAjuste = {
      fecha: this.hoyLocal(),
      productoId: item.id,
      stockDeseado: null,
      motivo: '',
    };
    this.errorAjuste = '';
    this.okAjuste = '';
    this.ajusteEnFila = true;
  }

  iniciarAjuste(item: InventarioItem): void {
    if (this.editando?.id === item.id) {
      this.editando = null;
      this.form = this.formVacio();
    } else if (this.editando) {
      this.cancelar();
    }
    this.prepAjusteEnFila(item);
    setTimeout(() => {
      document.querySelector('.fila-ajuste, .hist-ajuste-movil')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 0);
  }

  cancelarAjuste(): void {
    this.editandoAjuste = null;
    this.formAjuste = this.formAjusteVacio();
    this.errorAjuste = '';
    this.ajusteEnFila = false;
  }

  editarAjuste(a: AjusteInventario): void {
    this.editando = null;
    this.form = this.formVacio();
    this.ajusteEnFila = false;
    this.editandoAjuste = a;
    const actual = this.stockDe(a.productoId);
    const stockTrasAjuste =
      actual != null ? actual : Math.round(Number(a.cantidad) * 100) / 100;
    this.formAjuste = {
      fecha: a.fecha,
      productoId: a.productoId,
      // Muestra en cuánto quedó / está el stock tras ese ajuste.
      stockDeseado: stockTrasAjuste,
      motivo: a.motivo,
    };
    this.errorAjuste = '';
    this.okAjuste = '';
    this.ajusteAbierto = true;
    setTimeout(() => {
      document.getElementById('panel-ajuste-stock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  guardarAjuste(): void {
    this.errorAjuste = '';
    this.okAjuste = '';
    const cantidad = this.cantidadAjusteCalculada();
    if (this.formAjuste.productoId == null) {
      this.errorAjuste = 'Elige un producto';
      return;
    }
    if (this.formAjuste.stockDeseado == null || !Number.isFinite(Number(this.formAjuste.stockDeseado))) {
      this.errorAjuste = 'Indica en cuánto debe quedar el stock';
      return;
    }
    if (cantidad == null) {
      this.errorAjuste = 'El stock deseado es igual al actual (nada que ajustar)';
      return;
    }
    const motivo = (this.formAjuste.motivo || '').trim();
    if (!motivo) {
      this.errorAjuste = 'Elige el motivo';
      return;
    }
    const body = {
      fecha: this.formAjuste.fecha,
      productoId: this.formAjuste.productoId,
      cantidad,
      motivo,
    };
    this.guardandoAjuste = true;
    const req = this.editandoAjuste
      ? this.api.actualizarAjusteInventario(this.editandoAjuste.id, body)
      : this.api.crearAjusteInventario(body);
    req.subscribe({
      next: () => {
        this.guardandoAjuste = false;
        this.okAjuste = this.editandoAjuste ? 'Ajuste actualizado' : 'Ajuste registrado';
        const keepEdit = this.editando;
        this.cancelarAjuste();
        if (keepEdit) this.prepAjusteEnFila(keepEdit);
        this.cargar();
      },
      error: (e) => {
        this.guardandoAjuste = false;
        this.errorAjuste = e.error?.error || 'No se pudo guardar el ajuste';
      },
    });
  }

  async eliminarAjuste(a: AjusteInventario): Promise<void> {
    const ok = await this.confirmDlg.ask(`¿Eliminar ajuste de ${a.productoNombre}?`, {
      confirmarTexto: 'Eliminar',
    });
    if (!ok) return;
    this.api.eliminarAjusteInventario(a.id).subscribe({
      next: () => {
        this.okAjuste = 'Ajuste eliminado';
        if (this.editandoAjuste?.id === a.id) this.cancelarAjuste();
        this.cargar();
      },
      error: (e) => (this.errorAjuste = e.error?.error || 'No se pudo eliminar'),
    });
  }

  private rebuildFiltrados(reset = false): void {
    const q = this.filtro.trim().toLowerCase();
    const base = !q
      ? [...this.items]
      : this.items.filter((i) => i.nombre.toLowerCase().includes(q));
    base.sort((a, b) => compararNombreNatural(a.nombre, b.nombre));
    this.filtrados = base;
    this.pag.setItems(this.filtrados, reset);
  }

  onFiltroTexto(value: string): void {
    this.filtroTexto = value;
    if (this.filtroTimer != null) clearTimeout(this.filtroTimer);
    this.filtroTimer = setTimeout(() => {
      this.filtroTimer = null;
      this.filtro = this.filtroTexto;
      this.rebuildFiltrados(true);
      if (this.filtro.trim() && !this.listaAbierta) this.listaAbierta = true;
    }, 200);
  }

  aplicarBusqueda(): void {
    if (this.filtroTimer != null) {
      clearTimeout(this.filtroTimer);
      this.filtroTimer = null;
    }
    this.filtro = this.filtroTexto;
    this.rebuildFiltrados(true);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    if (!this.listaAbierta) this.listaAbierta = true;
    setTimeout(() => {
      this.listaResultados?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  onBuscarEnter(ev: Event): void {
    ev.preventDefault();
    this.aplicarBusqueda();
  }

  paginaAnterior(): void {
    if (!this.pag.anterior()) return;
    this.cancelar();
    this.scrollLista();
  }

  paginaSiguiente(): void {
    if (!this.pag.siguiente()) return;
    this.cancelar();
    this.scrollLista();
  }

  private scrollLista(): void {
    setTimeout(() => {
      this.listaResultados?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }

  toggleLista(): void {
    this.listaAbierta = !this.listaAbierta;
  }

  toggleAjuste(): void {
    this.ajusteAbierto = !this.ajusteAbierto;
  }

  toggleAlta(): void {
    this.altaAbierta = !this.altaAbierta;
  }

  private esMovil(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  }

  esPieza(i: InventarioItem): boolean {
    return i.vendePor === 'PIEZA' || i.vendePorLabel === 'Pieza';
  }

  etiquetaUnidad(i: InventarioItem): string {
    if (this.esPieza(i)) return 'Pieza';
    return i.vendePorLabel || 'Litros';
  }

  private sugeridoMin(compra: number | null): number {
    const c = Number(compra) || 0;
    if (c <= 0) return 0;
    return Math.round(c * (1 + Number(this.pct.min) / 100) * 100) / 100;
  }

  private sugeridoMax(compra: number | null): number {
    const c = Number(compra) || 0;
    if (c <= 0) return 0;
    return Math.round(c * (1 + Number(this.pct.max) / 100) * 100) / 100;
  }

  get sugeridoPlaceholder(): string {
    const min = this.sugeridoMin(this.form.precioCompra);
    if (min <= 0) return '';
    return `mín $${min} – máx $${this.sugeridoMax(this.form.precioCompra)}`;
  }

  get sugeridoPlaceholderAlta(): string {
    const u = this.unitarioAlta;
    const min = this.sugeridoMin(u);
    if (min <= 0) return 'Según unitario';
    return `mín $${min} – máx $${this.sugeridoMax(u)}`;
  }

  get sugeridoMinAlta(): number {
    return this.sugeridoMin(this.unitarioAlta);
  }

  get sugeridoMaxAlta(): number {
    return this.sugeridoMax(this.unitarioAlta);
  }

  /** Alta: todos los campos visibles con valor válido. */
  get altaCompleta(): boolean {
    const f = this.formAlta;
    if (!f.nombre?.trim()) return false;
    if (!f.vendePor) return false;
    const cant = this.cantidadAltaEfectiva;
    if (cant == null || cant <= 0) return false;
    if (f.totalPagado == null || String(f.totalPagado).trim() === '') return false;
    if (!Number.isFinite(Number(f.totalPagado)) || Number(f.totalPagado) <= 0) return false;
    if (this.unitarioAlta == null || this.unitarioAlta <= 0) return false;
    if (f.precioVenta == null || String(f.precioVenta).trim() === '') return false;
    if (!Number.isFinite(Number(f.precioVenta)) || Number(f.precioVenta) <= 0) return false;
    return true;
  }

  /** Vacío = 1 (una sola pieza/litro). */
  get cantidadAltaEfectiva(): number | null {
    const raw = this.formAlta.cantidadInicial;
    if (raw == null || String(raw).trim() === '') return 1;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  /** Precio unitario = total ÷ cantidad (cantidad vacía → 1). */
  get unitarioAlta(): number | null {
    const cant = this.cantidadAltaEfectiva;
    const total = Number(this.formAlta.totalPagado);
    if (cant == null || cant <= 0) return null;
    if (this.formAlta.totalPagado == null || String(this.formAlta.totalPagado).trim() === '') return null;
    if (!Number.isFinite(total) || total < 0) return null;
    return Math.round((total / cant) * 100) / 100;
  }

  onCompraChange(): void {
    if (this.form.precioVenta != null && Number(this.form.precioVenta) > 0) {
      this.calcularMayoreo(this.form);
    }
  }

  onMenudeoChange(): void {
    if (this.form.precioVenta == null || Number(this.form.precioVenta) <= 0) {
      this.form.precioMayoreo5 = null;
      this.form.precioMayoreo10 = null;
      return;
    }
    this.calcularMayoreo(this.form);
  }

  /** Recalcula unitario al cambiar cantidad o total (1 pieza o varias). */
  onCantidadAltaChange(valor: string | number | null): void {
    this.formAlta.cantidadInicial =
      valor === '' || valor == null ? null : (valor as number | null);
    this.sincronizarUnitarioAlta();
  }

  onTotalPagadoAltaChange(valor: string | number | null): void {
    this.formAlta.totalPagado =
      valor === '' || valor == null ? null : (valor as number | null);
    this.sincronizarUnitarioAlta();
  }

  private sincronizarUnitarioAlta(): void {
    const u = this.unitarioAlta;
    this.formAlta.precioCompra = u;
    if (u == null || u <= 0) {
      if (this.formAlta.precioVenta == null || Number(this.formAlta.precioVenta) <= 0) {
        this.formAlta.precioMayoreo5 = null;
        this.formAlta.precioMayoreo10 = null;
      }
      return;
    }
    if (this.formAlta.precioVenta != null && Number(this.formAlta.precioVenta) > 0) {
      this.calcularMayoreo(this.formAlta);
    }
  }

  /** @deprecated usar sincronizarUnitarioAlta */
  onLoteAltaChange(): void {
    this.sincronizarUnitarioAlta();
  }

  onMenudeoAltaChange(): void {
    if (this.formAlta.precioVenta == null || Number(this.formAlta.precioVenta) <= 0) {
      this.formAlta.precioMayoreo5 = null;
      this.formAlta.precioMayoreo10 = null;
      return;
    }
    this.calcularMayoreo(this.formAlta);
  }

  private calcularMayoreo(f: FormProducto): void {
    const c = Number(f.precioCompra) || 0;
    if (c <= 0) return;
    f.precioMayoreo5 = Math.round(c * (1 + Number(this.pct.mayoreo5) / 100) * 100) / 100;
    f.precioMayoreo10 = Math.round(c * (1 + Number(this.pct.mayoreo10) / 100) * 100) / 100;
  }

  cargar(): void {
    this.api.inventario().subscribe({
      next: (i) => {
        this.items = [...i].sort((a, b) => compararNombreNatural(a.nombre, b.nombre));
        this.rebuildFiltrados();
        this.aplicarQueryEditar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
    });
    this.api.ajustesInventario().subscribe({
      next: (a) => {
        this.ajustes = a;
        this.pagAjustes.setItems(a, false);
      },
    });
    this.api.margenes().subscribe({
      next: (m) => {
        this.margen = m;
        this.pct = {
          min: Number(m.porcentajeMin),
          max: Number(m.porcentajeMax),
          mayoreo5: Number(m.porcentajeMayoreo5),
          mayoreo10: Number(m.porcentajeMayoreo10),
        };
      },
    });
  }

  /** Desde Ventas: /inventario?editar=id → abre el producto en edición. */
  private aplicarQueryEditar(): void {
    const raw = this.route.snapshot.queryParamMap.get('editar');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    const item = this.items.find((x) => x.id === id);
    if (!item) return;
    this.listaAbierta = true;
    this.filtro = item.nombre;
    this.filtroTexto = item.nombre;
    this.rebuildFiltrados(true);
    const idx = this.filtrados.findIndex((x) => x.id === id);
    if (idx >= 0) {
      this.pag.pagina = Math.floor(idx / this.pag.pageSize) + 1;
    }
    this.editar(item);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  aplicarMargenesManuales(): void {
    this.normalizarPct();
    this.guardarMargenes();
  }

  private normalizarPct(): void {
    this.pct.min = Math.max(0, +Number(this.pct.min).toFixed(1));
    this.pct.max = Math.max(0, +Number(this.pct.max).toFixed(1));
    this.pct.mayoreo5 = Math.max(0, +Number(this.pct.mayoreo5).toFixed(1));
    this.pct.mayoreo10 = Math.max(0, +Number(this.pct.mayoreo10).toFixed(1));
    if (this.pct.min > this.pct.max) this.pct.max = this.pct.min;
    if (this.pct.mayoreo10 > this.pct.mayoreo5) this.pct.mayoreo5 = this.pct.mayoreo10;
  }

  guardarMargenes(): void {
    this.error = '';
    this.ok = '';
    this.guardandoMargen = true;
    this.api
      .actualizarMargenes({
        porcentajeMin: this.pct.min,
        porcentajeMax: this.pct.max,
        porcentajeMayoreo5: this.pct.mayoreo5,
        porcentajeMayoreo10: this.pct.mayoreo10,
      })
      .subscribe({
        next: (m) => {
          this.margen = m;
          this.pct = {
            min: Number(m.porcentajeMin),
            max: Number(m.porcentajeMax),
            mayoreo5: Number(m.porcentajeMayoreo5),
            mayoreo10: Number(m.porcentajeMayoreo10),
          };
          this.guardandoMargen = false;
          this.ok = 'Márgenes guardados: Mín/Máx solo actualizan columnas sugeridas';
          this.cargar();
        },
        error: (e) => {
          this.guardandoMargen = false;
          this.error = e.error?.error || 'No se pudieron guardar los márgenes';
        },
      });
  }

  async aplicarPreciosDesdeMargenes(): Promise<void> {
    this.normalizarPct();
    const ok = await this.confirmDlg.ask(
      '¿Recalcular Mín/Máx sugerido y mayoreo (≥5 / ≥10) con estos %?',
      { confirmarTexto: 'Recalcular' }
    );
    if (!ok) return;
    this.error = '';
    this.ok = '';
    this.guardandoMargen = true;
    this.api
      .actualizarMargenes({
        porcentajeMin: this.pct.min,
        porcentajeMax: this.pct.max,
        porcentajeMayoreo5: this.pct.mayoreo5,
        porcentajeMayoreo10: this.pct.mayoreo10,
      })
      .subscribe({
        next: () => {
          this.api.aplicarPreciosDesdeMargenes().subscribe({
            next: (m) => {
              this.margen = m;
              this.pct = {
                min: Number(m.porcentajeMin),
                max: Number(m.porcentajeMax),
                mayoreo5: Number(m.porcentajeMayoreo5),
                mayoreo10: Number(m.porcentajeMayoreo10),
              };
              this.guardandoMargen = false;
              this.ok = 'Columnas recalculadas';
              this.cargar();
            },
            error: (e) => {
              this.guardandoMargen = false;
              this.error = e.error?.error || 'No se pudieron recalcular las columnas';
            },
          });
        },
        error: (e) => {
          this.guardandoMargen = false;
          this.error = e.error?.error || 'No se pudieron guardar los márgenes';
        },
      });
  }

  private bodyDesde(f: FormProducto, opts?: { cantidadDefaultUno?: boolean }): Record<string, unknown> {
    this.calcularMayoreo(f);
    let cantidad = Number(f.cantidadInicial);
    if (opts?.cantidadDefaultUno && (f.cantidadInicial == null || String(f.cantidadInicial).trim() === '')) {
      cantidad = 1;
    }
    return {
      nombre: f.nombre,
      precioCompra: Number(f.precioCompra) || 0,
      cantidadInicial: Number.isFinite(cantidad) ? cantidad : 0,
      precioMayoreo5: f.precioMayoreo5,
      precioMayoreo10: f.precioMayoreo10,
      precioVenta: f.precioVenta,
      vendePor: f.vendePor || 'LITROS',
    };
  }

  guardarNuevo(): void {
    this.error = '';
    this.ok = '';
    if (!this.formAlta.nombre?.trim()) {
      this.error = 'Indica el nombre del producto';
      return;
    }
    const cant = this.cantidadAltaEfectiva;
    if (cant == null || cant <= 0) {
      this.error = 'La cantidad comprada no es válida';
      return;
    }
    this.sincronizarUnitarioAlta();
    if (
      this.formAlta.totalPagado == null ||
      String(this.formAlta.totalPagado).trim() === '' ||
      !Number.isFinite(Number(this.formAlta.totalPagado)) ||
      Number(this.formAlta.totalPagado) <= 0
    ) {
      this.error = 'Indica el total que pagaste';
      return;
    }
    if (this.unitarioAlta == null || this.unitarioAlta <= 0) {
      this.error = 'No se pudo calcular el precio unitario';
      return;
    }
    this.formAlta.precioCompra = this.unitarioAlta;
    if (
      this.formAlta.precioVenta == null ||
      String(this.formAlta.precioVenta).trim() === '' ||
      !Number.isFinite(Number(this.formAlta.precioVenta)) ||
      Number(this.formAlta.precioVenta) <= 0
    ) {
      this.error = 'Indica el precio de menudeo';
      return;
    }
    const body = this.bodyDesde(this.formAlta, { cantidadDefaultUno: true });
    this.api.crearProducto(body).subscribe({
      next: () => {
        this.formAlta = this.formVacio();
        this.ok = 'Producto agregado';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar producto'),
    });
  }

  async guardarEdicion(): Promise<void> {
    if (!this.editando) return;
    this.error = '';
    if (!this.form.nombre?.trim()) {
      this.error = 'Indica el nombre del producto';
      return;
    }
    const body = this.bodyDesde(this.form);
    const anterior = Number(this.editando.precioVentaHoy);
    const nuevo = Number(this.form.precioVenta);
    const cambioMenudeo =
      Number.isFinite(nuevo) &&
      nuevo > 0 &&
      (!Number.isFinite(anterior) || Math.abs(anterior - nuevo) > 0.009);
    if (cambioMenudeo) {
      const ok = await this.confirmDlg.ask(
        `¿Modificar el menudeo de $${anterior.toFixed(2)} a $${nuevo.toFixed(2)}?\nSe registrará en el histórico de precios.`,
        { titulo: 'Cambiar menudeo', confirmarTexto: 'Confirmar' }
      );
      if (!ok) return;
    } else {
      delete body['precioVenta'];
    }

    this.api.actualizarProducto(this.editando.id, body).subscribe({
      next: () => {
        this.cancelar();
        this.ok = 'Producto actualizado';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al guardar producto'),
    });
  }

  editar(item: InventarioItem): void {
    this.editando = item;
    this.form = {
      nombre: item.nombre,
      precioCompra: item.precioCompra,
      totalPagado: null,
      cantidadInicial: item.cantidadInicial,
      precioVenta: item.precioVentaHoy,
      precioMayoreo5: item.precioMayoreo5,
      precioMayoreo10: item.precioMayoreo10,
      vendePor: item.vendePor === 'PIEZA' ? 'PIEZA' : 'LITROS',
    };
    this.error = '';
    this.prepAjusteEnFila(item);
    setTimeout(() => {
      const el =
        document.querySelector('.hist-edicion-movil') || document.querySelector('.fila-edicion');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }

  cancelar(): void {
    this.editando = null;
    this.form = this.formVacio();
    this.cancelarAjuste();
  }

  async eliminar(item: InventarioItem): Promise<void> {
    const ok = await this.confirmDlg.ask(
      `¿Quitar «${item.nombre}» del inventario?\n\nSi tiene ventas o compras, se oculta pero el historial se conserva.`,
      {
        titulo: 'Quitar del inventario',
        confirmarTexto: 'Quitar',
      }
    );
    if (!ok) return;
    this.error = '';
    this.api.eliminarProducto(item.id).subscribe({
      next: () => {
        if (this.editando?.id === item.id) this.cancelar();
        else if (this.mostrandoAjusteEn(item)) this.cancelarAjuste();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo quitar el producto'),
    });
  }
}
