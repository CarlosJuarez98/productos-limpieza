package com.productoslimpieza.domain;

public enum TipoVenta {
  LITROS,
  PIEZA,
  MUESTRA,
  CASA,
  PESOS,
  RECARGA,
  PAGO_DE_SERVICIOS;

  public static TipoVenta fromExcel(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("Tipo de venta vacío");
    }
    String n = raw.trim().toLowerCase()
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u");
    return switch (n) {
      case "litros" -> LITROS;
      case "pieza" -> PIEZA;
      case "muestra" -> MUESTRA;
      case "casa" -> CASA;
      case "pesos" -> PESOS;
      case "recarga" -> RECARGA;
      case "pago de servicios" -> PAGO_DE_SERVICIOS;
      default -> throw new IllegalArgumentException("Tipo de venta desconocido: " + raw);
    };
  }

  public String toExcel() {
    return switch (this) {
      case LITROS -> "Litros";
      case PIEZA -> "Pieza";
      case MUESTRA -> "Muestra";
      case CASA -> "Casa";
      case PESOS -> "Pesos";
      case RECARGA -> "Recarga";
      case PAGO_DE_SERVICIOS -> "Pago de servicios";
    };
  }

  public boolean esProducto() {
    return this == LITROS || this == PIEZA || this == MUESTRA || this == CASA || this == PESOS;
  }

  public boolean descuentaStockUnidades() {
    return this == LITROS || this == PIEZA || this == MUESTRA || this == CASA;
  }

  public boolean totalEsCantidad() {
    return this == PESOS || this == RECARGA || this == PAGO_DE_SERVICIOS;
  }

  public boolean totalEsCero() {
    return this == MUESTRA || this == CASA;
  }
}
