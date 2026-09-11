import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AjusteInventario,
  Apartado,
  ApartadoRubro,
  ApartadosResumen,
  CajaResumen,
  CortePeriodo,
  Entrada,
  InventarioItem,
  InversionItem,
  InversionResumen,
  MargenConfig,
  MovimientoCaja,
  Persona,
  PrecioHistorico,
  Produccion,
  Receta,
  RecetaSugerida,
  PedidoSugerido,
  PedidoRegistrado,
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

  crearVentasLote(body: { fecha: string; lineas: unknown[] }): Observable<Venta[]> {
    return this.http.post<Venta[]>(`${this.base}/ventas/lote`, body);
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

  actualizarEntrada(id: number, body: unknown): Observable<Entrada> {
    return this.http.put<Entrada>(`${this.base}/entradas/${id}`, body);
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

  actualizarProduccion(id: number, body: unknown): Observable<Produccion> {
    return this.http.put<Produccion>(`${this.base}/producciones/${id}`, body);
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

  ajustesInventario(): Observable<AjusteInventario[]> {
    return this.http.get<AjusteInventario[]>(`${this.base}/ajustes-inventario`);
  }

  crearAjusteInventario(body: unknown): Observable<AjusteInventario> {
    return this.http.post<AjusteInventario>(`${this.base}/ajustes-inventario`, body);
  }

  actualizarAjusteInventario(id: number, body: unknown): Observable<AjusteInventario> {
    return this.http.put<AjusteInventario>(`${this.base}/ajustes-inventario/${id}`, body);
  }

  eliminarAjusteInventario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/ajustes-inventario/${id}`);
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

  recetas(): Observable<Receta[]> {
    return this.http.get<Receta[]>(`${this.base}/recetas`);
  }

  crearReceta(body: unknown): Observable<Receta> {
    return this.http.post<Receta>(`${this.base}/recetas`, body);
  }

  actualizarReceta(id: number, body: unknown): Observable<Receta> {
    return this.http.put<Receta>(`${this.base}/recetas/${id}`, body);
  }

  eliminarReceta(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/recetas/${id}`);
  }

  traspasos(): Observable<TraspasosResumen> {
    return this.http.get<TraspasosResumen>(`${this.base}/traspasos`);
  }

  personas(): Observable<Persona[]> {
    return this.http.get<Persona[]>(`${this.base}/personas`);
  }

  crearPersona(nombre: string): Observable<Persona> {
    return this.http.post<Persona>(`${this.base}/personas`, { nombre });
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

  crearApartadosLote(body: {
    fecha: string;
    lineas: Array<{
      categoria: string;
      ingreso: number;
      tipo: string;
      motivo?: string | null;
    }>;
  }): Observable<Apartado[]> {
    return this.http.post<Apartado[]>(`${this.base}/apartados/lote`, body);
  }

  eliminarApartado(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/apartados/${id}`);
  }

  crearApartadoRubro(nombre: string): Observable<ApartadoRubro> {
    return this.http.post<ApartadoRubro>(`${this.base}/apartados/rubros`, { nombre });
  }

  renombrarApartadoRubro(id: number, nombre: string): Observable<ApartadoRubro> {
    return this.http.put<ApartadoRubro>(`${this.base}/apartados/rubros/${id}`, { nombre });
  }

  eliminarApartadoRubro(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/apartados/rubros/${id}`);
  }

  inversion(): Observable<InversionResumen> {
    return this.http.get<InversionResumen>(`${this.base}/inversion`);
  }

  pedidoSugerido(opts?: {
    desde?: string;
    hasta?: string;
    diasCobertura?: number;
    porcentajeExtra?: number;
  }): Observable<PedidoSugerido> {
    let params = new HttpParams();
    if (opts?.desde) params = params.set('desde', opts.desde);
    if (opts?.hasta) params = params.set('hasta', opts.hasta);
    if (opts?.diasCobertura != null && opts.diasCobertura !== undefined) {
      params = params.set('diasCobertura', String(opts.diasCobertura));
    }
    if (opts?.porcentajeExtra != null && opts.porcentajeExtra !== undefined) {
      params = params.set('porcentajeExtra', String(opts.porcentajeExtra));
    }
    return this.http.get<PedidoSugerido>(`${this.base}/pedido-sugerido`, { params });
  }

  pedidos(): Observable<PedidoRegistrado[]> {
    return this.http.get<PedidoRegistrado[]>(`${this.base}/pedidos`);
  }

  pedidosAbiertos(): Observable<PedidoRegistrado[]> {
    return this.http.get<PedidoRegistrado[]>(`${this.base}/pedidos/abiertos`);
  }

  crearPedido(body: unknown): Observable<PedidoRegistrado> {
    return this.http.post<PedidoRegistrado>(`${this.base}/pedidos`, body);
  }

  cerrarPedido(id: number): Observable<PedidoRegistrado> {
    return this.http.post<PedidoRegistrado>(`${this.base}/pedidos/${id}/cerrar`, {});
  }

  registrarRecepcionPedido(
    id: number,
    lineas: { itemId: number; cantidadRecibida: number }[]
  ): Observable<PedidoRegistrado> {
    return this.http.post<PedidoRegistrado>(`${this.base}/pedidos/${id}/recepcion`, { lineas });
  }

  eliminarPedido(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/pedidos/${id}`);
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
