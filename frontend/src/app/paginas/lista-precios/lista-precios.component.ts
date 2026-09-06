import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';
import { InventarioItem } from '../../modelos';

@Component({
  selector: 'app-lista-precios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-precios.component.html',
})
export class ListaPreciosComponent implements OnInit {
  items: InventarioItem[] = [];
  filtro = '';
  hoy = new Date().toLocaleDateString('es-MX');

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.inventario().subscribe({ next: (i) => (this.items = i) });
  }

  get filtrados(): InventarioItem[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((i) => i.nombre.toLowerCase().includes(q));
  }

  imprimir(): void {
    window.print();
  }
}
