package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record InversionItemRequest(
    @NotBlank String tipo,
    @NotBlank String concepto,
    BigDecimal cantidad,
    BigDecimal precioUnidad,
    /** Opcional si vienen cantidad y precioUnidad. */
    BigDecimal monto
) {}
