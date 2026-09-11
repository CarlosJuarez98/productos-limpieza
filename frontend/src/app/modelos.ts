export type TipoVenta =
  | 'LITROS'
  | 'PIEZA'
  | 'MUESTRA'
  | 'CASA'
  | 'PESOS'
  | 'MAYOREO'
  | 'RECARGA'
  | 'PAGO_DE_SERVICIOS';

/** Cómo se captura la venta en UI (menudeo usa vendePor del producto). */
export type ModoVenta = 'MENUDEO' | 'MAYOREO' | 'MUESTRA' | 'PESOS';

export type UnidadVenta = 'LITROS' | 'PIEZA';

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
  /** Precio de la última compra previa de ese producto. */
  precioCompraAnterior: number | null;
  precioMayor: boolean;
  precioMenor: boolean;
  pedidoId: number | null;
  aplicadaAPedido: boolean;
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
  vendePor: UnidadVenta;
  vendePorLabel: string;
}

export interface AjusteInventario {
  id: number;
  fecha: string;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  motivo: string;
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
  /** Saldo en banco global. */
  totalTransferenciasNetas: number;
  totalNegocio: number;
  /** Fechas de corte registradas en BD. */
  fechasCorte: string[];
  fechaUltimoCorte: string | null;
  /** Sobrante del último corte a repartir (contado − fondo). */
  paraApartarUltimoCorte: number;
  /** Ya registrado en apartados tras ese corte. */
  yaApartadoDesdeUltimoCorte: number;
  /** Lo que aún falta por apartar del último corte. */
  disponibleParaApartar: number;
  retiros: MovimientoCaja[];
  ingresos: MovimientoCaja[];
  /** Histórico global de retiros del banco. */
  retirosTransferencia: MovimientoCaja[];
  /** Histórico global de transferencias a banco. */
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
  /** Contado − fondo que queda. */
  paraApartar: number | null;
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

export interface TraspasoLinea {
  id?: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioCompra: number;
  total: number;
}

export interface Traspaso {
  id: number;
  fecha: string;
  personaId: number | null;
  persona: string | null;
  nota: string | null;
  total: number;
  lineas: TraspasoLinea[];
}

export interface TraspasoAbono {
  id: number;
  fecha: string;
  monto: number;
  personaId: number | null;
  persona: string | null;
  nota: string | null;
}

export interface Persona {
  id: number;
  nombre: string;
}

export interface TraspasoSaldoPersona {
  personaId: number;
  persona: string;
  totalTraspasado: number;
  totalAbonado: number;
  saldo: number;
  estado: 'DEBE' | 'AL_CORRIENTE' | 'A_FAVOR' | string;
}

export interface TraspasosResumen {
  totalTraspasado: number;
  totalAbonado: number;
  saldoPendiente: number;
  personas: Persona[];
  saldosPorPersona: TraspasoSaldoPersona[];
  traspasos: Traspaso[];
  abonos: TraspasoAbono[];
}

export interface InversionItem {
  id: number;
  tipo: 'PRODUCTO' | 'INFRAESTRUCTURA' | string;
  concepto: string;
  cantidad: number | null;
  precioUnidad: number | null;
  monto: number;
}

export interface InversionResumen {
  /** Mercancía del arranque (ítems PRODUCTO). */
  totalProductosIniciales: number;
  totalInfraestructura: number;
  /** Productos iniciales + infraestructura = lo que hay que recuperar. */
  inversionInicial: number;
  totalStockAlta: number;
  totalEntradas: number;
  /** Compras posteriores con lo ganado (no suma al “faltante inicial”). */
  totalReinversion: number;
  totalVentas: number;
  retornoSobreInicial: number;
  inversionInicialRecuperada: boolean;
  faltantePorRecuperarInicial: number;
  gananciaSobreInicial: number;
  /** Costo de compra de lo vendido. */
  costoMercanciaVendida: number;
  /** Ventas − costo. */
  gananciaBruta: number;
  /** % sobre ventas. */
  margenPorcentaje: number;
  items: InversionItem[];
}

export interface PedidoLinea {
  productoId: number;
  productoNombre: string;
  vendePor: UnidadVenta;
  vendePorLabel: string;
  stockActual: number;
  /** Salida real en el periodo observado. */
  consumoObservado: number;
  /** Ritmo proyectado a los días de cobertura (p. ej. mes). */
  consumoBase: number;
  consumoConColchon: number;
  /** Faltante de pedidos abiertos anteriores. */
  faltanteAnterior: number;
  sugerido: number;
}

export interface InsumoAlerta {
  productoInsumoId: number;
  productoInsumoNombre: string;
  productoResultadoId: number;
  productoResultadoNombre: string;
  stockInsumo: number;
  stockResultado: number;
  sugeridoPedir: number;
  motivo: string;
}

export interface PedidoSugerido {
  desde: string;
  hasta: string;
  diasObservados: number;
  diasCobertura: number;
  porcentajeExtra: number;
  lineas: PedidoLinea[];
  alertasInsumos: InsumoAlerta[];
}

export interface PedidoItemRegistrado {
  id: number;
  productoId: number;
  productoNombre: string;
  vendePor: UnidadVenta;
  vendePorLabel: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  cantidadFaltante: number;
  /** Precio de compra actual en catálogo (prefill al recibir). */
  precioCompra: number | null;
}

export interface PedidoRegistrado {
  id: number;
  fecha: string;
  estado: 'ABIERTO' | 'PARCIAL' | 'CERRADO';
  periodoDesde: string | null;
  periodoHasta: string | null;
  diasCobertura: number | null;
  porcentajeExtra: number | null;
  nota: string | null;
  totalItems: number;
  itemsConFalta: number;
  items: PedidoItemRegistrado[];
}

export const MODOS_VENTA: { value: ModoVenta; label: string }[] = [
  { value: 'MENUDEO', label: 'Menudeo' },
  { value: 'MAYOREO', label: 'Mayoreo' },
  { value: 'MUESTRA', label: 'Muestra' },
  { value: 'PESOS', label: 'Pesos' },
];

/** @deprecated Usar MODOS_VENTA; se mantiene por compatibilidad. */
export const TIPOS_VENTA: { value: TipoVenta; label: string }[] = [
  { value: 'LITROS', label: 'Litros' },
  { value: 'PIEZA', label: 'Pieza' },
  { value: 'MAYOREO', label: 'Mayoreo' },
  { value: 'MUESTRA', label: 'Muestra' },
  { value: 'PESOS', label: 'Pesos' },
];
