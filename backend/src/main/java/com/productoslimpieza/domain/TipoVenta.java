package com.productoslimpieza.domain;

public enum TipoVenta {
  LITROS,
  PIEZA,
  MUESTRA,
  CASA,
  PESOS,
  MAYOREO,
  RECARGA,
  PAGO_DE_SERVICIOS;

  /** Parsea etiqueta de tipo (semilla / UI). */
  public static TipoVenta fromLabel(String raw) {
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
      case "mayoreo" -> MAYOREO;
      case "recarga" -> RECARGA;
      case "pago de servicios" -> PAGO_DE_SERVICIOS;
      default -> throw new IllegalArgumentException("Tipo de venta desconocido: " + raw);
    };
  }

  public String toLabel() {
    return switch (this) {
      case LITROS -> "Litros";
      case PIEZA -> "Pieza";
      case MUESTRA -> "Muestra";
      case CASA -> "Casa";
      case PESOS -> "Pesos";
      case MAYOREO -> "Mayoreo";
      case RECARGA -> "Recarga";
      case PAGO_DE_SERVICIOS -> "Pago de servicios";
    };
  }

  public boolean esProducto() {
    return this == LITROS || this == PIEZA || this == MUESTRA || this == CASA || this == PESOS || this == MAYOREO;
  }

  public boolean descuentaStockUnidades() {
    return this == LITROS || this == PIEZA || this == MUESTRA || this == CASA || this == MAYOREO;
  }

  public boolean totalEsCantidad() {
    return this == PESOS || this == RECARGA || this == PAGO_DE_SERVICIOS;
  }

  /** Total negociado a mano (no usa precio de lista). */
  public boolean totalEsManual() {
    return this == MAYOREO;
  }

  public boolean totalEsCero() {
    return this == MUESTRA || this == CASA;
  }
}
