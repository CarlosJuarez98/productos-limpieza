import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Apartado,
  ApartadosResumen,
  CajaResumen,
  CortePeriodo,
  Entrada,
  InventarioItem,
  InversionItem,
  InversionResumen,
  MargenConfig,
  MovimientoCaja,
  PrecioHistorico,
  Produccion,
  RecetaSugerida,
  Traspaso,
  TraspasoAbono,
  TraspasosResumen,
  Venta,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = '/api';

  constructor(private http: HttpClient) {}

  ventas(desde?: string, hasta?: string): Observable<Venta[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<Venta[]>(`${this.base}/ventas`, { params });
  }

  usoCasa(): Observable<Venta[]> {
    return this.http.get<Venta[]>(`${this.base}/casa`);
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

  crearEntradasLote(body: unknown): Observable<Entrada[]> {
    return this.http.post<Entrada[]>(`${this.base}/entradas/lote`, body);
  }

  eliminarEntrada(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/entradas/${id}`);
  }

  producciones(): Observable<Produccion[]> {
    return this.http.get<Produccion[]>(`${this.base}/producciones`);
  }

  recetaProduccion(productoResultadoId: number): Observable<RecetaSugerida> {
    return this.http.get<RecetaSugerida>(`${this.base}/producciones/receta/${productoResultadoId}`);
  }

  crearProduccion(body: unknown): Observable<Produccion> {
    return this.http.post<Produccion>(`${this.base}/producciones`, body);
  }

  eliminarProduccion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/producciones/${id}`);
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

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/inventario/${id}`);
  }

  margenes(): Observable<MargenConfig> {
    return this.http.get<MargenConfig>(`${this.base}/margenes`);
  }

  actualizarMargenes(body: {
    porcentajeMin: number;
    porcentajeMax: number;
    porcentajeMayoreo5: number;
    porcentajeMayoreo10: number;
  }): Observable<MargenConfig> {
    return this.http.put<MargenConfig>(`${this.base}/margenes`, body);
  }

  aplicarPreciosDesdeMargenes(): Observable<MargenConfig> {
    return this.http.post<MargenConfig>(`${this.base}/margenes/aplicar-precios`, {});
  }

  traspasos(): Observable<TraspasosResumen> {
    return this.http.get<TraspasosResumen>(`${this.base}/traspasos`);
  }

  crearTraspaso(body: unknown): Observable<Traspaso> {
    return this.http.post<Traspaso>(`${this.base}/traspasos`, body);
  }

  eliminarTraspaso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/traspasos/${id}`);
  }

  crearAbonoTraspaso(body: unknown): Observable<TraspasoAbono> {
    return this.http.post<TraspasoAbono>(`${this.base}/traspasos/abonos`, body);
  }

  eliminarAbonoTraspaso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/traspasos/abonos/${id}`);
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

  marcarCorte(body: {
    fechaCorte: string;
    fondoInicial?: number;
    totalCalculadora?: number;
    fondoPeriodo?: number;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/caja/cortes`, body);
  }

  detalleCorte(fecha: string): Observable<CortePeriodo> {
    return this.http.get<CortePeriodo>(`${this.base}/caja/cortes/${fecha}`);
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

  inversion(): Observable<InversionResumen> {
    return this.http.get<InversionResumen>(`${this.base}/inversion`);
  }

  crearInversion(body: unknown): Observable<InversionItem> {
    return this.http.post<InversionItem>(`${this.base}/inversion`, body);
  }

  actualizarInversion(id: number, body: unknown): Observable<InversionItem> {
    return this.http.put<InversionItem>(`${this.base}/inversion/${id}`, body);
  }

  eliminarInversion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/inversion/${id}`);
  }
}
