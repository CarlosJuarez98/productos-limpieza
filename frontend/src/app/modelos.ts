export type TipoVenta =
  | 'LITROS'
  | 'PIEZA'
  | 'MUESTRA'
  | 'CASA'
  | 'PESOS'
  | 'RECARGA'
  | 'PAGO_DE_SERVICIOS';

export type TipoMovimientoCaja =
  | 'RETIRO'
  | 'INGRESO'
  | 'RETIRO_TRANSFERENCIA'
  | 'TRANSFERENCIA';

export type CategoriaApartado = 'GENERAL' | 'PRODUCTOS' | 'CASA' | 'SALARIOS';

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
  totalCaja: number;
  totalTransferenciasNetas: number;
  totalNegocio: number;
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
}

export interface ApartadosResumen {
  totales: Record<CategoriaApartado, number>;
  movimientos: Apartado[];
}

export const TIPOS_VENTA: { value: TipoVenta; label: string }[] = [
  { value: 'LITROS', label: 'Litros' },
  { value: 'PIEZA', label: 'Pieza' },
  { value: 'MUESTRA', label: 'Muestra' },
  { value: 'CASA', label: 'Casa' },
  { value: 'PESOS', label: 'Pesos' },
  { value: 'RECARGA', label: 'Recarga' },
  { value: 'PAGO_DE_SERVICIOS', label: 'Pago de servicios' },
];
