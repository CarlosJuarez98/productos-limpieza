package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record EntradaLineaRequest(
    @NotNull Long productoId,
    @NotNull @Positive BigDecimal cantidad,
    BigDecimal precioProveedor
) {}
