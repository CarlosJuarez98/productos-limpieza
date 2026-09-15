import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
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
import { enfocarPorAttr, programarEnfoque, scrollLineaPorAttr } from '../../captura-focus.util';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
}

type DraftTraspasos = {
  form: {
    fecha: string;
    persona?: string;
    personaId?: number | null;
    personaNueva?: string;
    nota: string;
  };
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

  data: TraspasosResumen | null = null;
  pagTraspasos = new PaginacionEstado<Traspaso>();
  pagAbonos = new PaginacionEstado<TraspasoAbono>();
  productos: InventarioItem[] = [];
  error = '';
  private nextKey = 1;
  private pullSub?: Subscription;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  form = {
    fecha: this.hoyLocal(),
    personaId: null as number | null,
    personaNueva: '',
    nota: '',
  };
  lineas: LineaForm[] = [this.nuevaLinea()];
  abono = {
    fecha: this.hoyLocal(),
    monto: null as number | null,
    personaId: null as number | null,
    nota: '',
  };
  editandoId: number | null = null;
  private editandoOriginal: Traspaso | null = null;
  errorEdit = '';
  guardandoEdit = false;
  formEdit = {
    fecha: '',
    personaId: null as number | null,
    personaNueva: '',
    nota: '',
    lineas: [] as LineaForm[],
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
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
  }

  hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get fechaMax(): string {
    return this.hoyLocal();
  }

  private validarFecha(fecha: string, destino: 'error' | 'errorEdit' = 'error'): boolean {
    if (!fecha) {
      this[destino] = 'Indica la fecha';
      return false;
    }
    if (fecha > this.hoyLocal()) {
      this[destino] = 'No se pueden registrar traspasos con fecha futura';
      return false;
    }
    return true;
  }

  @HostListener('window:pagehide')
  @HostListener('document:visibilitychange')
  onGuardarBorrador(): void {
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

  get personasLista() {
    return this.data?.personas ?? [];
  }

  onPersonaListaCambio(): void {
    if (this.form.personaId != null) this.form.personaNueva = '';
    this.programarBorrador();
  }

  onPersonaEditCambio(): void {
    if (this.formEdit.personaId != null) this.formEdit.personaNueva = '';
  }

  private nombreDeLista(id: number | null): string {
    if (id == null) return '';
    return this.personasLista.find((p) => p.id === id)?.nombre?.trim() || '';
  }

  private nombrePersonaCaptura(): string {
    if (this.form.personaId != null) return this.nombreDeLista(this.form.personaId);
    return this.form.personaNueva.trim();
  }

  private nombrePersonaEdit(): string {
    if (this.formEdit.personaId != null) return this.nombreDeLista(this.formEdit.personaId);
    return this.formEdit.personaNueva.trim();
  }

  private aplicarNombrePersona(
    nombre: string | null | undefined,
    personaId: number | null | undefined
  ): { personaId: number | null; personaNueva: string } {
    if (personaId != null && this.nombreDeLista(personaId)) {
      return { personaId, personaNueva: '' };
    }
    const n = (nombre || '').trim();
    if (!n) return { personaId: null, personaNueva: '' };
    const p = this.personasLista.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
    if (p) return { personaId: p.id, personaNueva: '' };
    return { personaId: null, personaNueva: n };
  }

  agregarLinea(): void {
    this.lineas.push(this.nuevaLinea());
    this.programarBorrador();
    this.enfocarCaptura(this.lineas.length - 1, 'producto');
  }

  onFechaEnter(ev: Event): void {
    ev.preventDefault();
    this.enfocarCaptura(0, 'producto');
  }

  onProductoEnter(index: number): void {
    this.enfocarCaptura(index, 'cantidad');
  }

  onCantidadEnter(ev: Event, index: number): void {
    ev.preventDefault();
    this.programarBorrador();
    const irA = index + 1;
    if (irA >= this.lineas.length) {
      this.agregarLinea();
      return;
    }
    this.enfocarCaptura(irA, 'producto');
  }

  onProductoChange(l: LineaForm, id: number | null): void {
    l.productoId = id;
    this.programarBorrador();
  }

  private autosVisibles(): ProductoAutocompleteComponent[] {
    return (this.prodAutos?.toArray() || []).filter((a) => a.estaVisible());
  }

  private enfocarCaptura(index: number, campo: 'producto' | 'cantidad'): void {
    const go = () => {
      const key = this.lineas[index]?.key;
      if (campo === 'cantidad') {
        enfocarPorAttr('data-cant-key', key ?? '');
      } else {
        this.autosVisibles()[index]?.focus();
      }
      if (key != null) scrollLineaPorAttr('data-linea-key', key);
    };
    this.cdr.detectChanges();
    programarEnfoque(go);
  }

  quitarLinea(index: number): void {
    if (this.lineas.length <= 1) {
      this.lineas = [this.nuevaLinea()];
      this.programarBorrador();
      return;
    }
    this.lineas.splice(index, 1);
    this.programarBorrador();
  }

  private syncPaginadores(reset = false): void {
    this.pagTraspasos.setItems(this.data?.traspasos ?? [], reset);
    this.pagAbonos.setItems(this.data?.abonos ?? [], reset);
  }

  cargar(): void {
    this.api.traspasos().subscribe({
      next: (d) => {
        this.data = d;
        const cap = this.aplicarNombrePersona(this.nombrePersonaCaptura(), this.form.personaId);
        this.form.personaId = cap.personaId;
        this.form.personaNueva = cap.personaNueva;
        this.syncPaginadores(true);
      },
      error: (e) => (this.error = this.msgError(e) || 'No se pudieron cargar traspasos'),
    });
    this.api.inventario().subscribe({ next: (p) => (this.productos = p) });
  }

  guardar(): void {
    this.error = '';
    const persona = this.nombrePersonaCaptura();
    if (!persona) {
      this.error = this.form.personaId == null ? 'Escribe el nombre de la persona nueva' : 'Indica la persona';
      return;
    }
    if (!this.validarFecha(this.form.fecha)) return;
    const lineas = this.lineas
      .filter((l) => l.productoId != null && Number(l.cantidad) > 0)
      .map((l) => ({
        productoId: l.productoId as number,
        productoNombre: this.productos.find((x) => x.id === l.productoId)?.nombre,
        cantidad: Number(l.cantidad),
      }));
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
        persona,
        nota: this.form.nota || null,
        lineas,
      })
      .subscribe({
        next: () => {
          this.form.personaId = null;
          this.form.personaNueva = '';
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
    if (!this.validarFecha(this.abono.fecha)) return;
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
    if (this.editandoId === id) this.cancelarEdicion();
    this.api.eliminarTraspaso(id).subscribe({ next: () => this.cargar() });
  }

  editar(t: Traspaso): void {
    this.errorEdit = '';
    this.editandoId = t.id;
    this.editandoOriginal = t;
    this.formEdit = {
      fecha: t.fecha,
      ...this.aplicarNombrePersona(t.persona, t.personaId),
      nota: t.nota || '',
      lineas: (t.lineas || []).map((l) => ({
        key: this.nextKey++,
        productoId: l.productoId ?? null,
        cantidad: l.cantidad ?? null,
      })),
    };
    if (!this.formEdit.lineas.length) this.formEdit.lineas = [this.nuevaLinea()];
    this.cdr.detectChanges();
    setTimeout(() => {
      const el =
        document.querySelector('.hist-edicion-movil') || document.querySelector('.fila-edicion');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.editandoOriginal = null;
    this.errorEdit = '';
    this.guardandoEdit = false;
  }

  stockDisponibleEdit(productoId: number | null): number | null {
    if (productoId == null) return null;
    const actual = this.stockDisponible(productoId);
    if (actual == null) return null;
    const orig = (this.editandoOriginal?.lineas || [])
      .filter((l) => l.productoId === productoId)
      .reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
    return actual + orig;
  }

  excedeStockEdit(l: LineaForm, index: number): boolean {
    if (l.productoId == null) return false;
    const stock = this.stockDisponibleEdit(l.productoId);
    if (stock == null) return false;
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return false;
    const otros = this.formEdit.lineas.reduce((s, x, i) => {
      if (i === index || x.productoId !== l.productoId) return s;
      const c = Number(x.cantidad);
      return s + (Number.isFinite(c) && c > 0 ? c : 0);
    }, 0);
    return cant + otros > stock;
  }

  get hayExcesoStockEdit(): boolean {
    return this.formEdit.lineas.some((l, i) => this.excedeStockEdit(l, i));
  }

  guardarEdicion(): void {
    if (this.editandoId == null) return;
    this.errorEdit = '';
    const persona = this.nombrePersonaEdit();
    if (!persona) {
      this.errorEdit =
        this.formEdit.personaId == null ? 'Escribe el nombre de la persona nueva' : 'Indica la persona';
      return;
    }
    if (!this.validarFecha(this.formEdit.fecha, 'errorEdit')) return;
    const lineas = this.formEdit.lineas
      .filter((l) => l.productoId != null && Number(l.cantidad) > 0)
      .map((l) => ({ productoId: l.productoId as number, cantidad: Number(l.cantidad) }));
    if (!lineas.length) {
      this.errorEdit = 'Elige productos y su cantidad';
      return;
    }
    if (this.hayExcesoStockEdit) {
      this.errorEdit = 'Hay cantidades mayores al stock disponible';
      return;
    }
    this.guardandoEdit = true;
    this.api
      .actualizarTraspaso(this.editandoId, {
        fecha: this.formEdit.fecha,
        persona,
        nota: this.formEdit.nota || null,
        lineas,
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          this.cancelarEdicion();
          this.cargar();
        },
        error: (e) => {
          this.guardandoEdit = false;
          this.errorEdit = this.msgError(e) || 'Error al actualizar traspaso';
        },
      });
  }

  async eliminarAbono(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar abono?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    this.api.eliminarAbonoTraspaso(id).subscribe({ next: () => this.cargar() });
  }

  private hayBorradorUtil(): boolean {
    return (
      !!this.nombrePersonaCaptura() ||
      !!this.form.nota.trim() ||
      this.lineas.some(
        (l) =>
          l.productoId != null || (l.cantidad != null && Number(l.cantidad) !== 0)
      )
    );
  }

  programarBorrador(): void {
    if (this.draftTimer != null) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.persistirBorrador(), 200);
  }

  private persistirBorrador(): void {
    if (!this.hayBorradorUtil()) {
      this.drafts.clear(TraspasosComponent.DRAFT);
      return;
    }
    const draft: DraftTraspasos = {
      form: {
        fecha: this.form.fecha,
        personaId: this.form.personaId,
        personaNueva: this.form.personaNueva,
        nota: this.form.nota,
      },
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
        personaId: draft.form.personaId ?? null,
        personaNueva: (draft.form.personaNueva || draft.form.persona || '').trim(),
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
