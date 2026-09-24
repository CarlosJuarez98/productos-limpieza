import { ChangeDetectorRef, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import {
  Apartado,
  ApartadoRubro,
  ApartadosResumen,
  CajaResumen,
  TipoMovimientoApartado,
} from '../../modelos';
import { FechaDmYPipe } from '../../fecha-dmy.pipe';
import { FechaDiaComponent } from '../../fecha-dia.component';
import { PaginacionEstado } from '../../paginacion.util';
import { PaginadorComponent } from '../../paginador.component';
import { ClearableDirective } from '../../clearable.directive';
import { AutoHideDirective } from '../../auto-hide.directive';
import { enfocarInput, inputsVisiblesDe, navegarCampos, programarEnfoque } from '../../captura-focus.util';

/** Línea de gasto: partes sumadas (+) + monto en captura. */
interface GastoForm {
  key: number;
  categoria: string;
  /** Montos ya confirmados con el botón +. */
  partes: number[];
  /** Monto que se está escribiendo (entra al total aunque no pulse +). */
  montoActual: number | null;
  motivo: string;
}

@Component({
  selector: 'app-apartados',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmYPipe, FechaDiaComponent, PaginadorComponent, ClearableDirective, AutoHideDirective],
  templateUrl: './apartados.component.html',
  styleUrl: './apartados.component.scss',
})
export class ApartadosComponent implements OnInit {
  @ViewChildren('montoApartar') montoApartarInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('gastoCampo') gastoCampos!: QueryList<ElementRef<HTMLInputElement>>;

  data: ApartadosResumen | null = null;
  caja: CajaResumen | null = null;
  private pagMovs = new Map<string, PaginacionEstado<Apartado>>();
  error = '';
  ok = '';

  formIngreso = {
    fecha: this.hoyLocal(),
  };

  /** Fecha común para el lote de gastos. */
  fechaGasto = this.hoyLocal();

  private nextGastoKey = 1;
  gastos: GastoForm[] = [];

  /** Montos a repartir por código de rubro (liquida corte). */
  montos: Record<string, number | null> = {};

  nuevoRubroNombre = '';
  editandoRubroId: number | null = null;
  editandoRubroNombre = '';
  adminRubrosAbierto = false;
  editandoId: number | null = null;
  errorEdit = '';
  guardandoEdit = false;
  formEdit = {
    fecha: '',
    categoria: '',
    ingreso: null as number | null,
    motivo: '',
    tipo: 'INGRESO' as TipoMovimientoApartado,
  };

  readonly bloquesRegistros: { titulo: string; tipo: TipoMovimientoApartado }[] = [
    { titulo: 'Ganancias', tipo: 'INGRESO' },
    { titulo: 'Gastos', tipo: 'GASTO' },
  ];

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get rubros(): ApartadoRubro[] {
    return this.data?.rubros ?? [];
  }

  /** Rubros que reciben dinero de caja / liquidan corte. */
  get rubrosApartar(): ApartadoRubro[] {
    return this.rubros.filter((r) => r.liquidaCorte);
  }

  hoyLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  cargar(): void {
    forkJoin({
      apartados: this.api.apartados(),
      caja: this.api.caja(),
    }).subscribe({
      next: ({ apartados, caja }) => {
        this.data = apartados;
        this.caja = caja;
        this.syncMontosKeys();
        if (!this.gastos.length) {
          this.gastos = [this.nuevaGasto()];
        } else {
          const def = this.rubros[0]?.codigo ?? 'PRODUCTOS';
          for (const g of this.gastos) {
            if (!this.rubros.some((r) => r.codigo === g.categoria)) {
              g.categoria = def;
            }
          }
        }
        this.syncPaginadores(true);
      },
      error: (e) => (this.error = e.error?.error || 'No se pudieron cargar apartados'),
    });
  }

  private syncMontosKeys(): void {
    const next: Record<string, number | null> = {};
    for (const r of this.rubrosApartar) {
      next[r.codigo] = this.montos[r.codigo] ?? null;
    }
    this.montos = next;
  }

  get delCorteParaApartar(): number {
    const v = Number(this.caja?.paraApartarUltimoCorte);
    if (Number.isFinite(v)) return v;
    return Math.round((this.yaApartadoDelCorte + this.disponibleCaja) * 100) / 100;
  }

  get yaApartadoDelCorte(): number {
    const v = Number(this.caja?.yaApartadoDesdeUltimoCorte);
    if (Number.isFinite(v)) return v;
    return 0;
  }

  get disponibleCaja(): number {
    const v = Number(this.caja?.disponibleParaApartar);
    if (Number.isFinite(v)) return v;
    return 0;
  }

  saldo(cat: string): number {
    return Number(this.data?.totales?.[cat] ?? 0);
  }

  totalColumna(cat: string, tipo: TipoMovimientoApartado): number {
    if (tipo === 'INGRESO') {
      const v = Number(this.data?.ingresos?.[cat]);
      if (Number.isFinite(v)) return v;
    } else {
      const v = Number(this.data?.gastos?.[cat]);
      if (Number.isFinite(v)) return v;
    }
    return this.movimientosDe(cat, tipo).reduce((s, a) => s + (Number(a.ingreso) || 0), 0);
  }

  totalBloque(tipo: TipoMovimientoApartado): number {
    return (
      Math.round(this.rubros.reduce((s, c) => s + this.totalColumna(c.codigo, tipo), 0) * 100) / 100
    );
  }

  alturaBarra(tipo: TipoMovimientoApartado, cat: string): number {
    const v = this.totalColumna(cat, tipo);
    if (v <= 0) return 0;
    const max = Math.max(...this.rubros.map((c) => this.totalColumna(c.codigo, tipo)), 0);
    if (max <= 0) return 0;
    return Math.max(4, Math.round((v / max) * 100));
  }

  get totalSubapartados(): number {
    return Math.round(this.rubrosApartar.reduce((s, r) => s + this.saldo(r.codigo), 0) * 100) / 100;
  }

  movimientosDe(cat: string, tipo: TipoMovimientoApartado): Apartado[] {
    return (this.data?.movimientos ?? [])
      .filter((a) => a.categoria === cat && a.tipo === tipo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  private pagKey(cat: string, tipo: TipoMovimientoApartado): string {
    return `${tipo}-${cat}`;
  }

  private syncPaginadores(reset = false): void {
    for (const bloque of this.bloquesRegistros) {
      for (const cat of this.rubros) {
        const key = this.pagKey(cat.codigo, bloque.tipo);
        if (!this.pagMovs.has(key)) {
          this.pagMovs.set(key, new PaginacionEstado<Apartado>());
        }
        this.pagMovs.get(key)!.setItems(this.movimientosDe(cat.codigo, bloque.tipo), reset);
      }
    }
  }

  pagMov(cat: string, tipo: TipoMovimientoApartado): PaginacionEstado<Apartado> {
    const key = this.pagKey(cat, tipo);
    if (!this.pagMovs.has(key)) {
      const pag = new PaginacionEstado<Apartado>();
      pag.setItems(this.movimientosDe(cat, tipo));
      this.pagMovs.set(key, pag);
    }
    return this.pagMovs.get(key)!;
  }

  montoDe(codigo: string): number {
    return Math.max(0, Number(this.montos[codigo]) || 0);
  }

  get totalApartar(): number {
    return (
      Math.round(this.rubrosApartar.reduce((s, r) => s + this.montoDe(r.codigo), 0) * 100) / 100
    );
  }

  get restanteApartar(): number {
    return Math.round(Math.max(0, this.disponibleCaja - this.totalApartar) * 100) / 100;
  }

  get cabeEnCaja(): boolean {
    return this.totalApartar <= this.disponibleCaja + 0.001;
  }

  get puedeRegistrarReparto(): boolean {
    return this.totalApartar > 0 && this.cabeEnCaja;
  }

  onMontoInput(codigo: string, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const raw = el.value;
    if (raw === '' || raw == null) {
      this.montos[codigo] = null;
      return;
    }
    // Acepta punto o coma decimal; no reescribe el input mientras escriben "10." / "0,5".
    const normalized = String(raw).trim().replace(/,/g, '.');
    if (!/^\d*\.?\d{0,2}$/.test(normalized)) {
      el.value = this.montos[codigo] != null ? String(this.montos[codigo]) : '';
      return;
    }
    if (normalized === '.' || normalized.endsWith('.')) {
      const base = normalized === '.' ? 0 : Number(normalized.slice(0, -1));
      this.montos[codigo] = Number.isFinite(base) ? base : null;
      return;
    }
    const limpio = Number(normalized);
    if (!Number.isFinite(limpio)) {
      return;
    }
    if (limpio < 0) {
      this.montos[codigo] = null;
      el.value = '';
      return;
    }
    const otros = this.rubrosApartar
      .filter((r) => r.codigo !== codigo)
      .reduce((s, r) => s + this.montoDe(r.codigo), 0);
    const maxCampo = Math.round(Math.max(0, this.disponibleCaja - otros) * 100) / 100;
    const valor = Math.round(Math.min(limpio, maxCampo) * 100) / 100;
    this.montos[codigo] = valor;
    // Solo fuerza el valor si se tocó el tope de disponible (no al tipear decimales).
    if (valor < limpio) {
      el.value = String(valor);
    }
    this.cdr.detectChanges();
  }

  onApartarNav(ev: KeyboardEvent): void {
    navegarCampos(ev, inputsVisiblesDe(this.montoApartarInputs));
  }

  onGastoNav(ev: KeyboardEvent): void {
    navegarCampos(ev, inputsVisiblesDe(this.gastoCampos), {
      alFinalEnter: () => {
        this.agregarGasto();
        programarEnfoque(() => {
          const next = inputsVisiblesDe(this.gastoCampos);
          const montos = next.filter((_, i) => i % 2 === 0);
          enfocarInput(montos[montos.length - 1] ?? null);
        });
      },
    });
  }

  guardarGastos(): void {
    this.error = '';
    this.ok = '';
    const fecha = this.fechaGasto || this.hoyLocal();
    if (fecha > this.hoyLocal()) {
      this.error = 'La fecha del gasto no puede ser posterior a hoy';
      this.fechaGasto = this.hoyLocal();
      return;
    }

    const incompletas = this.gastos.filter((g) => {
      const monto = this.totalMontoGasto(g);
      const tieneMonto = monto > 0;
      const tieneMotivo = !!g.motivo?.trim();
      return (tieneMonto && !tieneMotivo) || (!tieneMonto && tieneMotivo);
    });
    if (incompletas.length) {
      this.error = 'Completa monto y motivo en cada gasto usado (o déjalo vacío)';
      return;
    }

    const lineas = this.gastos.filter((g) => this.totalMontoGasto(g) > 0 && !!g.motivo?.trim());
    if (!lineas.length) {
      this.error = 'Indica al menos un gasto';
      return;
    }

    const uso: Record<string, number> = {};
    for (const g of lineas) {
      uso[g.categoria] = (uso[g.categoria] || 0) + this.totalMontoGasto(g);
    }
    for (const [cat, pedRaw] of Object.entries(uso)) {
      const ped = Math.round(pedRaw * 100) / 100;
      if (ped <= 0) continue;
      const disponible = this.saldo(cat);
      if (ped > disponible + 0.001) {
        const nombre = this.rubros.find((r) => r.codigo === cat)?.nombre ?? cat;
        this.error = `En ${nombre} solo hay $${disponible.toFixed(2)}; intentas gastar $${ped.toFixed(2)}`;
        return;
      }
    }

    this.api
      .crearApartadosLote({
        fecha,
        lineas: lineas.map((g) => ({
          categoria: g.categoria,
          ingreso: this.totalMontoGasto(g),
          tipo: 'GASTO',
          motivo: g.motivo.trim(),
        })),
      })
      .subscribe({
        next: () => {
          const total = Math.round(lineas.reduce((s, g) => s + this.totalMontoGasto(g), 0) * 100) / 100;
          this.ok = `Se registraron ${lineas.length} gasto(s) por $${total.toFixed(2)}`;
          this.gastos = [this.nuevaGasto()];
          this.cargar();
        },
        error: (e) => (this.error = e.error?.error || 'Error al guardar gastos'),
      });
  }

  nuevaGasto(): GastoForm {
    return {
      key: this.nextGastoKey++,
      categoria: this.rubros[0]?.codigo ?? 'PRODUCTOS',
      partes: [],
      montoActual: null,
      motivo: '',
    };
  }

  /** Suma partes confirmadas + lo que hay en el input. */
  totalMontoGasto(g: GastoForm): number {
    const sumPartes = g.partes.reduce((s, p) => s + p, 0);
    const actual = Number(g.montoActual);
    const extra = Number.isFinite(actual) && actual > 0 ? actual : 0;
    return Math.round((sumPartes + extra) * 100) / 100;
  }

  detallePartes(g: GastoForm): string {
    const bits = g.partes.map((p) => p.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    const actual = Number(g.montoActual);
    if (Number.isFinite(actual) && actual > 0) {
      bits.push(actual.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    }
    return bits.join(' + ');
  }

  /** Confirma el monto del input como parte y deja el campo listo para otro. */
  sumarMontoGasto(g: GastoForm): void {
    const n = Number(g.montoActual);
    if (!Number.isFinite(n) || n <= 0) return;
    g.partes = [...g.partes, Math.round(n * 100) / 100];
    g.montoActual = null;
  }

  quitarUltimaParte(g: GastoForm): void {
    if (!g.partes.length) return;
    g.partes = g.partes.slice(0, -1);
  }

  agregarGasto(): void {
    this.gastos.push(this.nuevaGasto());
  }

  quitarGasto(index: number): void {
    if (this.gastos.length <= 1) {
      this.gastos = [this.nuevaGasto()];
      return;
    }
    this.gastos.splice(index, 1);
  }

  get totalGastosForm(): number {
    return Math.round(this.gastos.reduce((s, g) => s + this.totalMontoGasto(g), 0) * 100) / 100;
  }

  registrarReparto(): void {
    this.error = '';
    this.ok = '';
    const total = this.totalApartar;

    if (total <= 0) {
      this.error = 'Indica al menos un monto a apartar';
      return;
    }
    if (total > this.disponibleCaja + 0.001) {
      this.error = `No puedes apartar $${total.toFixed(2)}: en caja solo hay $${this.disponibleCaja.toFixed(2)}`;
      return;
    }

    const fecha = this.formIngreso.fecha || this.hoyLocal();
    if (fecha > this.hoyLocal()) {
      this.error = 'La fecha de apartar no puede ser posterior a hoy';
      this.formIngreso.fecha = this.hoyLocal();
      return;
    }
    const lineas = this.rubrosApartar
      .filter((r) => this.montoDe(r.codigo) > 0)
      .map((r) => ({
        categoria: r.codigo,
        ingreso: this.montoDe(r.codigo),
        tipo: 'INGRESO' as const,
        motivo: null as string | null,
      }));

    this.api.crearApartadosLote({ fecha, lineas }).subscribe({
      next: () => {
        this.ok = `Se apartaron $${total.toFixed(2)} de la caja`;
        this.montos = {};
        this.syncMontosKeys();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'Error al registrar el reparto'),
    });
  }

  crearRubro(): void {
    this.error = '';
    this.ok = '';
    const nombre = this.nuevoRubroNombre.trim();
    if (!nombre) {
      this.error = 'Escribe el nombre del nuevo apartado';
      return;
    }
    this.api.crearApartadoRubro(nombre).subscribe({
      next: () => {
        this.ok = `Apartado «${nombre}» creado`;
        this.nuevoRubroNombre = '';
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo crear el apartado'),
    });
  }

  toggleAdminRubros(): void {
    this.adminRubrosAbierto = !this.adminRubrosAbierto;
    if (!this.adminRubrosAbierto) {
      this.cancelarEditarRubro();
    }
  }

  empezarEditarRubro(r: ApartadoRubro): void {
    this.editandoRubroId = r.id;
    this.editandoRubroNombre = r.nombre;
  }

  cancelarEditarRubro(): void {
    this.editandoRubroId = null;
    this.editandoRubroNombre = '';
  }

  guardarNombreRubro(r: ApartadoRubro): void {
    this.error = '';
    this.ok = '';
    const nombre = this.editandoRubroNombre.trim();
    if (!nombre) {
      this.error = 'El nombre no puede quedar vacío';
      return;
    }
    this.api.renombrarApartadoRubro(r.id, nombre).subscribe({
      next: () => {
        this.ok = `Apartado renombrado a «${nombre}»`;
        this.cancelarEditarRubro();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo renombrar'),
    });
  }

  async eliminarRubro(r: ApartadoRubro): Promise<void> {
    this.error = '';
    this.ok = '';
    if (this.rubros.length <= 1) {
      this.error = 'Debe quedar al menos un apartado';
      return;
    }
    const ok = await this.confirmDlg.ask(`¿Borrar el apartado «${r.nombre}»?`, {
      confirmarTexto: 'Borrar',
    });
    if (!ok) return;
    this.api.eliminarApartadoRubro(r.id).subscribe({
      next: () => {
        this.ok = `Apartado «${r.nombre}» borrado`;
        if (this.editandoRubroId === r.id) this.cancelarEditarRubro();
        this.cargar();
      },
      error: (e) => (this.error = e.error?.error || 'No se pudo borrar el apartado'),
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirmDlg.ask('¿Eliminar movimiento de apartado?', { confirmarTexto: 'Eliminar' });
    if (!ok) return;
    if (this.editandoId === id) this.cancelarEdicion();
    this.api.eliminarApartado(id).subscribe({ next: () => this.cargar() });
  }

  editar(a: Apartado): void {
    this.error = '';
    this.errorEdit = '';
    this.editandoId = a.id;
    this.formEdit = {
      fecha: a.fecha,
      categoria: a.categoria,
      ingreso: Number(a.ingreso),
      motivo: a.motivo || '',
      tipo: a.tipo,
    };
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.errorEdit = '';
    this.guardandoEdit = false;
  }

  guardarEdicion(): void {
    if (this.editandoId == null) return;
    this.errorEdit = '';
    const fecha = this.formEdit.fecha || this.hoyLocal();
    if (fecha > this.hoyLocal()) {
      this.errorEdit = 'La fecha no puede ser posterior a hoy';
      return;
    }
    const monto = Number(this.formEdit.ingreso);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.errorEdit = 'Indica un monto mayor a 0';
      return;
    }
    if (!this.formEdit.categoria) {
      this.errorEdit = 'Elige el apartado';
      return;
    }
    if (this.formEdit.tipo === 'GASTO' && !this.formEdit.motivo.trim()) {
      this.errorEdit = 'Indica el motivo del gasto';
      return;
    }
    this.guardandoEdit = true;
    this.api
      .actualizarApartado(this.editandoId, {
        fecha,
        categoria: this.formEdit.categoria,
        ingreso: monto,
        tipo: this.formEdit.tipo,
        motivo: this.formEdit.motivo.trim() || null,
      })
      .subscribe({
        next: () => {
          this.guardandoEdit = false;
          this.cancelarEdicion();
          this.cargar();
        },
        error: (e) => {
          this.guardandoEdit = false;
          this.errorEdit = e.error?.error || 'No se pudo guardar el cambio';
        },
      });
  }
}
