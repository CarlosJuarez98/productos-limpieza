import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly links = [
    { path: '/ventas', label: 'Ventas' },
    { path: '/entradas', label: 'Entradas' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/uso-casa', label: 'Uso en casa' },
    { path: '/traspasos', label: 'Traspasos' },
    { path: '/caja', label: 'Caja' },
    { path: '/apartados', label: 'Apartados' },
    { path: '/precios', label: 'Histórico precios' },
    { path: '/lista-precios', label: 'Lista precios' },
  ];
}
