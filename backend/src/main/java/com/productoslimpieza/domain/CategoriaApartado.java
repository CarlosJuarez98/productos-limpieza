package com.productoslimpieza.domain;

/**
 * Códigos reservados / históricos. Los rubros de usuario viven en {@link ApartadoRubro};
 * en movimientos se guarda el {@code codigo} como texto.
 */
public enum CategoriaApartado {
  GENERAL,
  PRODUCTOS,
  CASA,
  SALARIOS,
  /** Servicios/recargas; no es rubro de UI ni liquida el corte de productos. */
  SERVICIOS
}
