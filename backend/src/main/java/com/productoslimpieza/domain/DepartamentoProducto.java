package com.productoslimpieza.domain;

/** Proveedor / área de surtido. Independiente de litros vs pieza. */
public enum DepartamentoProducto {
  LIMPIEZA,
  JARCERIA;

  public String toLabel() {
    return this == JARCERIA ? "Jarcería" : "Limpieza";
  }

  public static DepartamentoProducto inferir(UnidadVenta vendePor, String nombre) {
    String n = nombre == null ? "" : nombre.toLowerCase();
    if (n.contains("cloro") || n.contains("pastilla") || n.contains("tableta")) {
      return LIMPIEZA;
    }
    if (vendePor == UnidadVenta.PIEZA) {
      return JARCERIA;
    }
    return LIMPIEZA;
  }

  public static DepartamentoProducto fromRaw(String raw) {
    if (raw == null || raw.isBlank()) return LIMPIEZA;
    String n = raw.trim().toUpperCase();
    if (n.startsWith("JARC")) return JARCERIA;
    return LIMPIEZA;
  }
}
