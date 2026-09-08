import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { InventarioItem, TraspasosResumen } from '../../modelos';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';

interface LineaForm {
  key: number;
  productoId: number | null;
  cantidad: number | null;
}

@Component({
  selector: 'app-traspasos',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoAutocompleteComponent, FechaDmYPipe],
  templateUrl: './traspasos.component.html',
  styleUrl: './traspasos.component.scss',
})
export class TraspasosComponent implements OnInit {
  @ViewChildren('prodLote') prodAutos!: QueryList<ProductoAutocompleteComponent>;
  @ViewChildren('cantInput') cantInputs!: QueryList<ElementRef<HTMLInputElement>>;

  data: TraspasosResumen | null = null;
  productos: InventarioItem[] = [];
  error = '';
  private nextKey = 1;
  form = {
    fecha: new Date().toISOString().slice(0, 10),
    persona: '',
    nota: '',
  };
  lineas: LineaForm[] = [this.nuevaLinea(), this.nuevaLinea(), this.nuevaLinea()];
  abono = {
    fecha: new Date().toISOString().slice(0, 10),
    monto: null as number | null,
    personaId: null as number | null,
    nota: '',
  };

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  private nuevaLinea(): LineaForm {
    return { key: this.nextKey++, productoId: null, cantidad: null };
  }

  precioCompra(productoId: number | null): number {
    if (productoId == null) return 0;
    return Number(this.productos.find((x) => x.id === productoId)?.precioCompra) || 0;
  }

  totalLinea(l: LineaForm): number {
    const cant = Number(l.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return 0;
    return Math.round(cant * this.precioCompra(l.productoId) * 100) / 100;
  }

  get totalEstimado(): number {
    return Math.round(this.lineas.reduce((s, l) => s + this.totalLinea(l), 0) * 100) / 100;
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

  cargar(): void {
    this.api.traspasos().subscribe({
      next: (d) => (this.data = d),
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar traspasos'),
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
          this.lineas = [this.nuevaLinea(), this.nuevaLinea(), this.nuevaLinea()];
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar traspaso'),
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
        error: (e) => (this.error = e.error?.error || 'Error al guardar abono'),
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
}
