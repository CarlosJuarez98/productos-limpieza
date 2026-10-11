package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoAbonoRequest(
    @NotNull LocalDate fecha,
    @NotNull @Positive BigDecimal monto,
    String nota,
    LocalDate fechaLimitePago,
    /** Si true, todo el pago es con dinero del admin (préstamo). */
    Boolean conDineroPropio,
    /**
     * Legado: mixto Productos + mi dinero. Ignorado si {@code partes} trae elementos.
     */
    BigDecimal montoDineroPropio,
    /**
     * Pago repartido: N apartados y/o MI_DINERO. La suma debe igualar {@code monto}.
     */
    @Valid List<PedidoAbonoParteRequest> partes
) {
  public boolean esConDineroPropio() {
    return Boolean.TRUE.equals(conDineroPropio);
  }

  public boolean tienePartes() {
    return partes != null && !partes.isEmpty();
  }

  public BigDecimal parteDineroPropio() {
    if (esConDineroPropio()) {
      return monto;
    }
    if (montoDineroPropio == null) {
      return BigDecimal.ZERO;
    }
    return montoDineroPropio;
  }
}
