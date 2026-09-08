package com.productoslimpieza.domain;

/** Unidad de menudeo del producto (cómo se vende al contado). */
public enum UnidadVenta {
  LITROS,
  PIEZA;

  public TipoVenta toTipoVentaMenudeo() {
    return this == PIEZA ? TipoVenta.PIEZA : TipoVenta.LITROS;
  }

  public String toLabel() {
    return this == PIEZA ? "Pieza" : "Litros";
  }

  public static UnidadVenta fromRaw(String raw) {
    if (raw == null || raw.isBlank()) {
      return LITROS;
    }
    String n = raw.trim().toUpperCase();
    if (n.startsWith("PIEZ") || n.equals("PZA") || n.equals("PZ")) {
      return PIEZA;
    }
    return LITROS;
  }
}
