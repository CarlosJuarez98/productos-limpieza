package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * Una parte del pago al proveedor.
 * {@code categoria = "MI_DINERO"} → préstamo del admin; otro código → gasto de ese apartado.
 */
public record PedidoAbonoParteRequest(
    String categoria,
    @NotNull @Positive BigDecimal monto
) {
  public boolean esMiDinero() {
    return categoria != null && "MI_DINERO".equalsIgnoreCase(categoria.trim());
  }

  public String codigoApartado() {
    if (esMiDinero() || categoria == null || categoria.isBlank()) {
      return null;
    }
    return categoria.trim();
  }
}
