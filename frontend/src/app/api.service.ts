import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Apartado,
  ApartadosResumen,
  CajaResumen,
  Entrada,
  InventarioItem,
  MovimientoCaja,
  PrecioHistorico,
  Venta,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'http://localhost:8083/api';

  constructor(private http: HttpClient) {}

  ventas(desde?: string, hasta?: string): Observable<Venta[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<Venta[]>(`${this.base}/ventas`, { params });
  }

  crearVenta(body: unknown): Observable<Venta> {
    return this.http.post<Venta>(`${this.base}/ventas`, body);
  }

  actualizarVenta(id: number, body: unknown): Observable<Venta> {
    return this.http.put<Venta>(`${this.base}/ventas/${id}`, body);
  }

  eliminarVenta(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/ventas/${id}`);
  }

  entradas(): Observable<Entrada[]> {
    return this.http.get<Entrada[]>(`${this.base}/entradas`);
  }

  crearEntrada(body: unknown): Observable<Entrada> {
    return this.http.post<Entrada>(`${this.base}/entradas`, body);
  }

  eliminarEntrada(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/entradas/${id}`);
  }

  inventario(): Observable<InventarioItem[]> {
    return this.http.get<InventarioItem[]>(`${this.base}/inventario`);
  }

  crearProducto(body: unknown): Observable<InventarioItem> {
    return this.http.post<InventarioItem>(`${this.base}/inventario`, body);
  }

  actualizarProducto(id: number, body: unknown): Observable<InventarioItem> {
    return this.http.put<InventarioItem>(`${this.base}/inventario/${id}`, body);
  }

  precios(): Observable<PrecioHistorico[]> {
    return this.http.get<PrecioHistorico[]>(`${this.base}/precios`);
  }

  crearPrecio(body: unknown): Observable<PrecioHistorico> {
    return this.http.post<PrecioHistorico>(`${this.base}/precios`, body);
  }

  eliminarPrecio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/precios/${id}`);
  }

  caja(): Observable<CajaResumen> {
    return this.http.get<CajaResumen>(`${this.base}/caja`);
  }

  actualizarCajaConfig(body: unknown): Observable<unknown> {
    return this.http.put(`${this.base}/caja/config`, body);
  }

  crearMovimientoCaja(body: unknown): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(`${this.base}/caja/movimientos`, body);
  }

  eliminarMovimientoCaja(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/caja/movimientos/${id}`);
  }

  apartados(): Observable<ApartadosResumen> {
    return this.http.get<ApartadosResumen>(`${this.base}/apartados`);
  }

  crearApartado(body: unknown): Observable<Apartado> {
    return this.http.post<Apartado>(`${this.base}/apartados`, body);
  }

  eliminarApartado(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/apartados/${id}`);
  }
}
