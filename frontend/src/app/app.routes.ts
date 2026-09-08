import { Routes } from '@angular/router';
import { VentasComponent } from './paginas/ventas/ventas.component';
import { EntradasComponent } from './paginas/entradas/entradas.component';
import { InventarioComponent } from './paginas/inventario/inventario.component';
import { CajaComponent } from './paginas/caja/caja.component';
import { ApartadosComponent } from './paginas/apartados/apartados.component';
import { PreciosComponent } from './paginas/precios/precios.component';
import { ListaPreciosComponent } from './paginas/lista-precios/lista-precios.component';
import { UsoCasaComponent } from './paginas/uso-casa/uso-casa.component';
import { TraspasosComponent } from './paginas/traspasos/traspasos.component';
import { InversionComponent } from './paginas/inversion/inversion.component';

export const routes: Routes = [
  { path: '', redirectTo: 'ventas', pathMatch: 'full' },
  { path: 'ventas', component: VentasComponent },
  { path: 'entradas', component: EntradasComponent },
  { path: 'inventario', component: InventarioComponent },
  { path: 'uso-casa', component: UsoCasaComponent },
  { path: 'traspasos', component: TraspasosComponent },
  { path: 'caja', component: CajaComponent },
  { path: 'apartados', component: ApartadosComponent },
  { path: 'inversion', component: InversionComponent },
  { path: 'precios', component: PreciosComponent },
  { path: 'lista-precios', component: ListaPreciosComponent },
];
