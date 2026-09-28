import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { AutoHideDirective } from '../../auto-hide.directive';
import { SoloNumerosDirective } from '../../solo-numeros.directive';
import { ProductoAutocompleteComponent } from '../../producto-autocomplete.component';
import { InventarioItem } from '../../modelos';
import { PullRefreshService } from '../../pull-refresh.service';

@Component({
  selector: 'app-armar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AutoHideDirective,
    SoloNumerosDirective,
    ProductoAutocompleteComponent,
  ],
  templateUrl: './armar.component.html',
  styleUrl: './armar.component.scss',
  host: {
    '[class.armar-embebido]': 'embebido',
  },
})
export class ArmarComponent implements OnInit, OnDestroy {
  /** true = panel dentro de Entradas (sin título de página). */
  @Input() embebido = false;

  error = '';
  ok = '';
  cargando = false;
  armandoId: number | null = null;
  guardandoId: number | null = null;
  agregarId: number | null = null;
  items: InventarioItem[] = [];
  cantidades: Record<number, number | null> = {};
  private pullSub?: Subscription;

  constructor(
    private api: ApiService,
    private pullRefresh: PullRefreshService,
    private confirmDlg: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.pullSub = this.pullRefresh.refresh$.subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.pullSub?.unsubscribe();
  }

  get baston(): InventarioItem | undefined {
    return this.items.find((i) => i.esBaston) || this.items.find((i) => /bast[oó]n/i.test(i.nombre || ''));
  }

  get pendientes(): InventarioItem[] {
    return this.items
      .filter((i) => i.usaBaston && (Number(i.pendienteArmar) || 0) > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Solo los que ya marcaste para armar. */
  get configurados(): InventarioItem[] {
    return this.items
      .filter((i) => i.usaBaston && !i.esBaston)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Candidatos a agregar (inventario menos los ya en lista y el bastón). */
  get productosParaAgregar(): InventarioItem[] {
    return this.items.filter((i) => !i.esBaston && !i.usaBaston);
  }

  cargar(): void {
    this.cargando = true;
    this.api.inventario().subscribe({
      next: (list) => {
        this.items = list || [];
        this.cargando = false;
        for (const p of this.pendientes) {
          if (this.cantidades[p.id] == null) {
            this.cantidades[p.id] = Number(p.pendienteArmar) || null;
          }
        }
      },
      error: () => {
        this.cargando = false;
        this.error = 'No se pudo cargar el inventario';
      },
    });
  }

  agregarALista(): void {
    this.error = '';
    this.ok = '';
    let p =
      this.agregarId != null ? this.items.find((x) => x.id === this.agregarId) : undefined;
    if (!p) {
      this.error = 'Elige un producto de la lista (haz clic en la sugerencia)';
      return;
    }
    if (p.esBaston) {
      this.error = 'Ese producto es el bastón, no se arma';
      return;
    }
    if (p.usaBaston) {
      this.error = 'Ya está en la lista';
      return;
    }
    this.setUsaBaston(p, true);
  }

  async quitarDeLista(p: InventarioItem): Promise<void> {
    const pend = Number(p.pendienteArmar) || 0;
    if (pend > 0) {
      const ok = await this.confirmDlg.ask(
        `«${p.nombre}» tiene ${pend} pendiente(s) de armar. ¿Lo quitas de la lista igual?`,
        { confirmarTexto: 'Quitar' },
      );
      if (!ok) return;
    }
    this.setUsaBaston(p, false);
  }

  private setUsaBaston(p: InventarioItem, checked: boolean): void {
    this.error = '';
    this.ok = '';
    this.guardandoId = p.id;
    this.api
      .actualizarProducto(p.id, {
        nombre: p.nombre,
        precioCompra: Number(p.precioCompra) || 0,
        cantidadInicial: p.cantidadInicial ?? 0,
        precioVenta: Number(p.precioVentaHoy) > 0 ? Number(p.precioVentaHoy) : null,
        precioMayoreo5: Number(p.precioMayoreo5) > 0 ? Number(p.precioMayoreo5) : null,
        precioMayoreo10: Number(p.precioMayoreo10) > 0 ? Number(p.precioMayoreo10) : null,
        vendePor: p.vendePor,
        departamento: p.departamento || null,
        usaBaston: checked,
        esBaston: false,
        bastonesPorUnidad: Number(p.bastonesPorUnidad) || 1,
        bastonProductoId: this.baston?.id ?? p.bastonProductoId ?? null,
      })
      .subscribe({
        next: (actualizado) => {
          this.guardandoId = null;
          if (checked && !actualizado.usaBaston) {
            this.error =
              'El servidor no guardó «usa bastón». Reinicia la API (mvn spring-boot:run) y vuelve a intentar.';
            this.cargar();
            return;
          }
          this.agregarId = null;
          this.ok = checked
            ? `«${actualizado.nombre}» agregado a la lista`
            : `«${actualizado.nombre}» quitado de la lista`;
          this.cargar();
        },
        error: (e) => {
          this.guardandoId = null;
          this.error = e.error?.error || 'No se pudo guardar';
        },
      });
  }

  stockBaston(): number {
    return Number(this.baston?.stockActual) || 0;
  }

  bastonesNecesarios(p: InventarioItem, cant: number): number {
    const por = Number(p.bastonesPorUnidad) || 1;
    return Math.round(cant * por * 100) / 100;
  }

  async armar(p: InventarioItem): Promise<void> {
    this.error = '';
    this.ok = '';
    const cant = Math.round(Number(this.cantidades[p.id]) || 0);
    if (cant <= 0) {
      this.error = 'Indica cuántas unidades armar';
      return;
    }
    const pend = Number(p.pendienteArmar) || 0;
    if (cant > pend) {
      this.error = `Solo hay ${pend} pendientes de «${p.nombre}»`;
      return;
    }
    const need = this.bastonesNecesarios(p, cant);
    if (need > this.stockBaston()) {
      this.error = `Faltan bastones: necesitas ${need}, hay ${this.stockBaston()}`;
      return;
    }
    const ok = await this.confirmDlg.ask(
      `¿Armar ${cant} «${p.nombre}»?\nSe descontarán ${need} bastón(es).`,
      { confirmarTexto: 'Armar' },
    );
    if (!ok) return;
    this.armandoId = p.id;
    this.api.armarProducto({ productoId: p.id, cantidad: cant }).subscribe({
      next: (r) => {
        this.armandoId = null;
        this.ok = `Armadas ${r.cantidadArmada} «${r.productoNombre}» · bastones usados: ${r.bastonesUsados}`;
        this.cantidades[p.id] = null;
        this.cargar();
      },
      error: (e) => {
        this.armandoId = null;
        this.error = e.error?.error || 'No se pudo armar';
      },
    });
  }
}
