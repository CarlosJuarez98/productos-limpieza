import { Routes } from '@angular/router';
import { VentasComponent } from './paginas/ventas/ventas.component';
import { EntradasComponent } from './paginas/entradas/entradas.component';
import { InventarioComponent } from './paginas/inventario/inventario.component';
import { CajaComponent } from './paginas/caja/caja.component';
import { ApartadosComponent } from './paginas/apartados/apartados.component';
import { PreciosComponent } from './paginas/precios/precios.component';
import { ListaPreciosComponent } from './paginas/lista-precios/lista-precios.component';

export const routes: Routes = [
  { path: '', redirectTo: 'ventas', pathMatch: 'full' },
  { path: 'ventas', component: VentasComponent },
  { path: 'entradas', component: EntradasComponent },
  { path: 'inventario', component: InventarioComponent },
  { path: 'caja', component: CajaComponent },
  { path: 'apartados', component: ApartadosComponent },
  { path: 'precios', component: PreciosComponent },
  { path: 'lista-precios', component: ListaPreciosComponent },
];
