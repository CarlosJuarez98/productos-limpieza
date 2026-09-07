export type TipoVenta =
  | 'LITROS'
  | 'PIEZA'
  | 'MUESTRA'
  | 'CASA'
  | 'PESOS'
  | 'MAYOREO'
  | 'RECARGA'
  | 'PAGO_DE_SERVICIOS';

export type TipoMovimientoCaja =
  | 'RETIRO'
  | 'INGRESO'
  | 'RETIRO_TRANSFERENCIA'
  | 'TRANSFERENCIA';

export type CategoriaApartado = 'GENERAL' | 'PRODUCTOS' | 'CASA' | 'SALARIOS' | 'SERVICIOS';
export type TipoMovimientoApartado = 'INGRESO' | 'GASTO';

export interface Venta {
  id: number;
  fecha: string;
  productoId: number | null;
  productoNombre: string | null;
  tipoVenta: TipoVenta;
  tipoVentaLabel: string;
  cantidad: number;
  total: number;
}

export interface Entrada {
  id: number;
  fecha: string;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioProveedor: number | null;
  total: number | null;
  precioCompraAnterior: number;
  precioMayor: boolean;
}

export interface InventarioItem {
  id: number;
  nombre: string;
  precioVentaHoy: number;
  precioMayoreo5: number;
  precioMayoreo10: number;
  precioCompra: number;
  precioMinimoSugerido: number;
  precioMaximoSugerido: number;
  cantidadInicial: number;
  stockActual: number;
  utilizadoEnCasa: number;
  utilizadoEnCasaMonto: number;
  porcentajeGanancia: number;
  precioVentaBajoMinimo: boolean;
}

export interface PrecioHistorico {
  id: number;
  productoId: number;
  productoNombre: string;
  fechaVigencia: string;
  precio: number;
}

export interface MovimientoCaja {
  id: number;
  fecha: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string | null;
}

export interface CajaResumen {
  fechaInicio: string | null;
  fechaFin: string | null;
  fondoInicial: number;
  totalVendidoProductos: number;
  totalRecargas: number;
  totalPagoServicios: number;
  totalRetiros: number;
  totalIngresos: number;
  totalRetirosTransferencia: number;
  totalTransferencias: number;
  totalApartadosProductos: number;
  totalApartadosServicios: number;
  totalCaja: number;
  totalTransferenciasNetas: number;
  totalNegocio: number;
  /** Fechas de corte registradas en BD. */
  fechasCorte: string[];
  fechaUltimoCorte: string | null;
  retiros: MovimientoCaja[];
  ingresos: MovimientoCaja[];
  retirosTransferencia: MovimientoCaja[];
  transferencias: MovimientoCaja[];
}

export interface CortePeriodo {
  fechaCorte: string;
  periodoDesde: string;
  periodoHasta: string;
  fondoInicial: number;
  totalVendidoProductos: number;
  totalRecargas: number;
  totalPagoServicios: number;
  totalIngresos: number;
  totalRetiros: number;
  totalTransferencias: number;
  totalRetirosTransferencia: number;
  totalApartadosProductos: number;
  totalApartadosServicios: number;
  totalCaja: number;
  totalTransferenciasNetas: number;
  totalNegocio: number;
  totalCalculadora: number | null;
  diferencia: number | null;
  retiros: MovimientoCaja[];
  ingresos: MovimientoCaja[];
  retirosTransferencia: MovimientoCaja[];
  transferencias: MovimientoCaja[];
}

export interface Apartado {
  id: number;
  fecha: string;
  categoria: CategoriaApartado;
  ingreso: number;
  tipo: TipoMovimientoApartado;
  motivo: string | null;
}

export interface ApartadosResumen {
  /** Saldos actuales (ingresos − gastos). */
  totales: Record<CategoriaApartado, number>;
  ingresos: Record<CategoriaApartado, number>;
  gastos: Record<CategoriaApartado, number>;
  movimientos: Apartado[];
}

export interface Produccion {
  id: number;
  fecha: string;
  productoResultadoId: number;
  productoResultadoNombre: string;
  cantidadResultado: number;
  productoInsumoId: number;
  productoInsumoNombre: string;
  cantidadInsumo: number;
}

export interface RecetaSugerida {
  productoResultadoId: number;
  productoResultadoNombre: string;
  productoInsumoId: number | null;
  productoInsumoNombre: string | null;
  encontrada: boolean;
}

export interface MargenConfig {
  margenMin: number;
  margenMax: number;
  margenMayoreo5: number;
  margenMayoreo10: number;
  porcentajeMin: number;
  porcentajeMax: number;
  porcentajeMayoreo5: number;
  porcentajeMayoreo10: number;
}

export interface Traspaso {
  id: number;
  fecha: string;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioCompra: number;
  total: number;
  persona: string | null;
  nota: string | null;
}

export interface TraspasoAbono {
  id: number;
  fecha: string;
  monto: number;
  persona: string | null;
  nota: string | null;
}

export interface TraspasosResumen {
  totalTraspasado: number;
  totalAbonado: number;
  saldoPendiente: number;
  traspasos: Traspaso[];
  abonos: TraspasoAbono[];
}

export const TIPOS_VENTA: { value: TipoVenta; label: string }[] = [
  { value: 'LITROS', label: 'Litros' },
  { value: 'PIEZA', label: 'Pieza' },
  { value: 'MAYOREO', label: 'Mayoreo' },
  { value: 'MUESTRA', label: 'Muestra' },
  { value: 'PESOS', label: 'Pesos' },
  { value: 'RECARGA', label: 'Recarga' },
  { value: 'PAGO_DE_SERVICIOS', label: 'Pago de servicios' },
];
