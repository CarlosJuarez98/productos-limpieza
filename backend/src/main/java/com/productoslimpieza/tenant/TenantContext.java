package com.productoslimpieza.tenant;

/**
 * Usuario dueño de los datos en la sesión actual ({@code admin} o {@code mama}).
 */
public final class TenantContext {

  private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

  private TenantContext() {}

  public static void set(String tenantId) {
    if (tenantId == null || tenantId.isBlank()) {
      CURRENT.remove();
      return;
    }
    CURRENT.set(normalize(tenantId));
  }

  public static String get() {
    return CURRENT.get();
  }

  public static String require() {
    String t = CURRENT.get();
    if (t == null || t.isBlank()) {
      throw new IllegalStateException("No hay tenant en contexto");
    }
    return t;
  }

  public static void clear() {
    CURRENT.remove();
  }

  /** Misma normalización que el login: minúsculas sin acento. */
  public static String normalize(String raw) {
    if (raw == null) return "";
    String u = java.text.Normalizer.normalize(raw.trim(), java.text.Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .toLowerCase(java.util.Locale.ROOT);
    if ("mama".equals(u)) return "mama";
    if ("admin".equals(u)) return "admin";
    return u;
  }
}
