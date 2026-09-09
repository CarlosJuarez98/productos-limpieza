import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, MargenConfig } from '../../modelos';

type FormProducto = {
  nombre: string;
  precioCompra: number | null;
  cantidadInicial: number | null;
  precioVenta: number | null;
  precioMayoreo5: number | null;
  precioMayoreo10: number | null;
  vendePor: 'LITROS' | 'PIEZA';
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

const COLS_STORAGE = 'pl.inventario.columnas';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss',
})
export class InventarioComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
  error = '';
  ok = '';
  guardandoMargen = false;
  editando: InventarioItem | null = null;
  menuColumnas = false;
  menuMargenes = false;
  readonly columnas: ColDef[] = [
    { key: 'producto', label: 'Producto', fijo: true },
    { key: 'vende', label: 'Se vende' },
    { key: 'menudeo', label: 'Menudeo', fijo: true },
    { key: 'm5', label: '≥ 5 L' },
    { key: 'm10', label: '≥ 10 L' },
    { key: 'compra', label: 'Compra' },
    { key: 'minSug', label: 'Mín. sugerido' },
    { key: 'maxSug', label: 'Máx. sugerido' },
    { key: 'stock', label: 'Stock', fijo: true },
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
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.cargarVisibles();
    this.cargar();
  }

  @HostListener('document:click')
  cerrarMenus(): void {
    this.menuColumnas = false;
    this.menuMargenes = false;
  }

  private defaultsVisibles(): Record<ColKey, boolean> {
    const movil = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    return {
      producto: true,
      vende: !movil,
      menudeo: true,
      m5: !movil,
      m10: !movil,
      compra: !movil,
      minSug: !movil,
      maxSug: !movil,
      stock: true,
      ganancia: true,
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

  get colspanEdicion(): number {
    return 1 + this.columnas.filter((c) => this.col(c.key)).length;
  }

  private formVacio(): FormProducto {
    return {
      nombre: '',
      precioCompra: null,
      cantidadInicial: null,
      precioVenta: null,
      precioMayoreo5: null,
      precioMayoreo10: null,
      vendePor: 'LITROS',
    };
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
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
    const min = this.sugeridoMin(this.formAlta.precioCompra);
    if (min <= 0) return '';
    return `mín $${min} – máx $${this.sugeridoMax(this.formAlta.precioCompra)}`;
  }

  /** Alta: todos los campos visibles con valor válido. */
  get altaCompleta(): boolean {
    const f = this.formAlta;
    if (!f.nombre?.trim()) return false;
    if (!f.vendePor) return false;
    if (f.cantidadInicial == null || String(f.cantidadInicial).trim() === '') return false;
    if (!Number.isFinite(Number(f.cantidadInicial)) || Number(f.cantidadInicial) < 0) return false;
    if (f.precioCompra == null || String(f.precioCompra).trim() === '') return false;
    if (!Number.isFinite(Number(f.precioCompra)) || Number(f.precioCompra) <= 0) return false;
    if (f.precioVenta == null || String(f.precioVenta).trim() === '') return false;
    if (!Number.isFinite(Number(f.precioVenta)) || Number(f.precioVenta) <= 0) return false;
    return true;
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

  onCompraAltaChange(): void {
    if (this.formAlta.precioVenta != null && Number(this.formAlta.precioVenta) > 0) {
      this.calcularMayoreo(this.formAlta);
    }
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
      next: (i) => (this.items = i),
      error: (e) => (this.error = e.error?.error || 'No se pudo cargar inventario'),
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

  private bodyDesde(f: FormProducto): Record<string, unknown> {
    this.calcularMayoreo(f);
    return {
      nombre: f.nombre,
      precioCompra: Number(f.precioCompra) || 0,
      cantidadInicial: Number(f.cantidadInicial) || 0,
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
    if (this.formAlta.cantidadInicial == null || String(this.formAlta.cantidadInicial).trim() === '') {
      this.error = 'Indica la cantidad comprada';
      return;
    }
    if (!Number.isFinite(Number(this.formAlta.cantidadInicial)) || Number(this.formAlta.cantidadInicial) < 0) {
      this.error = 'La cantidad comprada no es válida';
      return;
    }
    if (
      this.formAlta.precioCompra == null ||
      String(this.formAlta.precioCompra).trim() === '' ||
      !Number.isFinite(Number(this.formAlta.precioCompra)) ||
      Number(this.formAlta.precioCompra) <= 0
    ) {
      this.error = 'Indica el precio de compra';
      return;
    }
    if (
      this.formAlta.precioVenta == null ||
      String(this.formAlta.precioVenta).trim() === '' ||
      !Number.isFinite(Number(this.formAlta.precioVenta)) ||
      Number(this.formAlta.precioVenta) <= 0
    ) {
      this.error = 'Indica el precio de menudeo';
      return;
    }
    const body = this.bodyDesde(this.formAlta);
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
      cantidadInicial: item.cantidadInicial,
      precioVenta: item.precioVentaHoy,
      precioMayoreo5: item.precioMayoreo5,
      precioMayoreo10: item.precioMayoreo10,
      vendePor: item.vendePor === 'PIEZA' ? 'PIEZA' : 'LITROS',
    };
    this.error = '';
    setTimeout(() => {
      const el =
        document.querySelector('.hist-edicion-movil') || document.querySelector('.fila-edicion');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }

  cancelar(): void {
    this.editando = null;
    this.form = this.formVacio();
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
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo quitar el producto'),
    });
  }
}
