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
import { SurtirComponent } from './paginas/surtir/surtir.component';
import { LoginComponent } from './paginas/login/login.component';
import { authGuard, guestGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: '', redirectTo: 'ventas', pathMatch: 'full' },
  { path: 'ventas', component: VentasComponent, canActivate: [authGuard] },
  { path: 'entradas', component: EntradasComponent, canActivate: [authGuard] },
  { path: 'surtir', component: SurtirComponent, canActivate: [authGuard] },
  { path: 'inventario', component: InventarioComponent, canActivate: [authGuard] },
  { path: 'uso-casa', component: UsoCasaComponent, canActivate: [authGuard] },
  { path: 'traspasos', component: TraspasosComponent, canActivate: [authGuard] },
  { path: 'caja', component: CajaComponent, canActivate: [authGuard] },
  { path: 'apartados', component: ApartadosComponent, canActivate: [authGuard] },
  { path: 'inversion', component: InversionComponent, canActivate: [authGuard] },
  { path: 'precios', component: PreciosComponent, canActivate: [authGuard] },
  { path: 'lista-precios', component: ListaPreciosComponent, canActivate: [authGuard] },
];
