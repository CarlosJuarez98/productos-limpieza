import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { CapturaDraftService } from '../../captura-draft.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { ClearableDirective } from '../../clearable.directive';
import { InventarioItem, TraspasosResumen } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { PullRefreshService } from '../../pull-refresh.service';
import { capturaLineasVacias, PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { Traspaso, TraspasoAbono } from '../../modelos';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
}

type DraftTraspasos = {
  form: { fecha: string; persona: string; nota: string };
  lineas: Omit<LineaForm, 'key'>[];
  nextKey: number;
};

@Component({
  selector: 'app-traspasos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductoAutocompleteComponent,
    FechaDmYPipe,
    ClearableDirective,
    PaginadorComponent,
  ],
  templateUrl: './traspasos.component.html',
  styleUrl: './traspasos.component.scss',
})
export class TraspasosComponent implements OnInit, OnDestroy {
  private static readonly DRAFT = 'traspasos';

  @ViewChildren('prodLote') prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;

  data: TraspasosResumen | null = null;
  pagTraspasos = new PaginacionEstado<Traspaso>();
  pagAbonos = new PaginacionEstado<TraspasoAbono>();
  productos: InventarioItem[] = [];
  error = '';
  private nextKey = 1;
  private pullSub?: Subscription;
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    persona: '',
    nota: '',
  };
  lineas: LineaForm[] = [this.nuevaLinea()];
  abono = {
    fecha: new Date().toISOString().slice(0, 10),
    monto: null as number | null,
    personaId: null as number | null,
    nota: '',
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private pullRefresh: PullRefreshService,
    private drafts: CapturaDraftService
  ) {}

  ngOnInit(): void {
    this.restaurarBorrador();
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.persistirBorrador();
    this.pullSub?.unsubscribe();
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.persistirBorrador();
  }

  private nuevaLinea(): LineaForm {
    return { key: this.nextKey++, productoId: null, cantidad: null };
  }

  precioCompra(productoId: number | null): number {
    if (productoId == null) return 0;
    return Number(this.productos.find((x) => x.id === productoId)?.precioCompra) || 0;
  }

  stockDisponible(productoId: number | null): number | null {
    if (productoId == null) return null;
    const p = this.productos.find((x) => x.id === productoId);
    if (!p) return null;
    return Number(p.stockActual) || 0;
  }

  /** Cantidad pedida del mismo producto en otras filas (sin contar `exceptoIndex`). */
  cantidadPedidaOtros(productoId: number, exceptoIndex: number): number {
    return this.lineas.reduce((s, l, i) => {
      if (i === exceptoIndex || l.productoId !== productoId) return s;
      const c = Number(l.cantidad);
      return s + (Number.isFinite(c) && c > 0 ? c : 0);
    }, 0);
  }

  excedeStock(l: LineaForm, index: number): boolean {
    if (l.productoId == null) return false;
    const stock = this.stockDisponible(l.productoId);
    if (stock == null) return false;
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return false;
    return cant + this.cantidadPedidaOtros(l.productoId, index) > stock;
  }

  totalLinea(l: LineaForm): number {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return 0;
    return Math.round(cant * this.precioCompra(l.productoId) * 100) / 100;
  }

  get totalEstimado(): number {
    return Math.round(this.lineas.reduce((s, l) => s + this.totalLinea(l), 0) * 100) / 100;
  }

  get hayExcesoStock(): boolean {
    return this.lineas.some((l, i) => this.excedeStock(l, i));
  }

  private msgError(e: { error?: { error?: string }; message?: string; statusText?: string }): string {
    return e?.error?.error || e?.message || e?.statusText || 'Error de servidor';
  }

  get saldoPersonaAbono(): number | null {
    if (this.abono.personaId == null || !this.data?.saldosPorPersona) return null;
    const s = this.data.saldosPorPersona.find((x) => x.personaId === this.abono.personaId);
    return s ? Number(s.saldo) : 0;
  }

  get personasParaAbono() {
    if (!this.data) return [];
    if (this.data.saldosPorPersona?.length) {
      return this.data.saldosPorPersona.map((s) => ({
        id: s.personaId,
        nombre: s.persona,
        saldo: Number(s.saldo),
      }));
    }
    return (this.data.personas ?? []).map((p) => ({ id: p.id, nombre: p.nombre, saldo: 0 }));
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
  }

  onProductoEnter(index: number): void {
    setTimeout(() => this.focusCantidad(index), 0);
  }

  onCantidadEnter(ev: Event, index: number): void {
    ev.preventDefault();
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      this.cdr.detectChanges();
    }
    setTimeout(() => this.focusProducto(irA), 0);
  }

  private focusProducto(index: number): void {
    this.prodAutos?.get(index)?.focus();
  }

  private focusCantidad(index: number): void {
    const el = this.cantInputs?.get(index)?.nativeElement;
    if (!el) return;
    el.focus();
    el.select();
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas = [this.nuevaLinea()];
      return;
    }
    this.lineas.splice(index, 1);
  }

  private syncPaginadores(reset = false): void {
    this.pagTraspasos.setItems(this.data?.traspasos ?? [], reset);
    this.pagAbonos.setItems(this.data?.abonos ?? [], reset);
  }

  cargar(): void {
    this.api.traspasos().subscribe({
      next: (d) => {
        this.data = d;
        this.syncPaginadores(true);
      },
      error: (e) => (this.error = this.msgError(e) || 'No se pudieron cargar traspasos'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.error = '';
    if (!this.form.persona?.trim()) {
      this.error = 'Indica la persona';
      return;
    }
    const lineas = this.lineas
      .filter((l) => l.productoId != null && Number(l.cantidad) > 0)
      .map((l) => ({ productoId: l.productoId as number, cantidad: Number(l.cantidad) }));
    if (!lineas.length) {
      this.error = 'Elige productos del inventario y su cantidad';
      return;
    }
    if (this.hayExcesoStock) {
      this.error = 'Hay cantidades mayores al stock disponible';
      return;
    }
    this.api
      .crearTraspaso({
        fecha: this.form.fecha,
        persona: this.form.persona.trim(),
        nota: this.form.nota || null,
        lineas,
      })
      .subscribe({
        next: () => {
          this.form.persona = '';
          this.form.nota = '';
          this.lineas = Array.from({ length: capturaLineasVacias() }, () => this.nuevaLinea());
          this.drafts.clear(TraspasosComponent.DRAFT);
          this.cargar();
        },
        error: (e) => {
          this.error = this.msgError(e) || 'Error al guardar traspaso';
          this.persistirBorrador();
        },
      });
  }

  guardarAbono(): void {
    this.error = '';
    if (this.abono.personaId == null) {
      this.error = 'Selecciona la persona de la lista';
      return;
    }
    if (!(Number(this.abono.monto) > 0)) {
      this.error = 'Indica el monto del abono';
      return;
    }
    this.api
      .crearAbonoTraspaso({
        fecha: this.abono.fecha,
        monto: this.abono.monto,
        personaId: this.abono.personaId,
        nota: this.abono.nota || null,
      })
      .subscribe({
        next: () => {
          this.abono.monto = null;
          this.abono.personaId = null;
          this.abono.nota = '';
          this.cargar();
        },
        error: (e) => (this.error = this.msgError(e) || 'Error al guardar abono'),
      });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar traspaso completo?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarTraspaso(id).subscribe({ next: () => this.cargar() });
  }

  async eliminarAbono(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar abono?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarAbonoTraspaso(id).subscribe({ next: () => this.cargar() });
  }

  private hayBorradorUtil(): boolean {
    return (
      !!this.form.persona.trim() ||
      !!this.form.nota.trim() ||
      this.lineas.some(
        (l) =>
          l.productoId != null || (l.cantidad != null && Number(l.cantidad) !== 0)
      )
    );
  }

  private persistirBorrador(): void {
    if (!this.hayBorradorUtil()) {
      this.drafts.clear(TraspasosComponent.DRAFT);
      return;
    }
    const draft: DraftTraspasos = {
      form: { ...this.form },
      nextKey: this.nextKey,
      lineas: this.lineas.map(({ productoId, cantidad }) => ({ productoId, cantidad })),
    };
    this.drafts.save(TraspasosComponent.DRAFT, draft);
  }

  private restaurarBorrador(): void {
    const draft = this.drafts.load<DraftTraspasos>(TraspasosComponent.DRAFT);
    if (!draft) return;
    if (draft.form) {
      this.form = {
        fecha: draft.form.fecha || this.form.fecha,
        persona: draft.form.persona || '',
        nota: draft.form.nota || '',
      };
    }
    this.nextKey = Math.max(1, Number(draft.nextKey) || 1);
    if (draft.lineas?.length) {
      this.lineas = draft.lineas.map((l) => ({
        key: this.nextKey++,
        productoId: l.productoId ?? null,
        cantidad: l.cantidad ?? null,
      }));
    }
  }
}
