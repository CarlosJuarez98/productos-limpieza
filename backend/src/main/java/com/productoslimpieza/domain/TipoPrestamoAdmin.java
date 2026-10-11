package com.productoslimpieza.domain;

/** Movimiento de deuda del negocio hacia el admin (quien pone dinero propio). */
public enum TipoPrestamoAdmin {
  /** El admin puso/pagó de su bolsa → el negocio le debe. */
  PRESTAMO,
  /** El negocio ya le regresó al admin. */
  DEVOLUCION
}
