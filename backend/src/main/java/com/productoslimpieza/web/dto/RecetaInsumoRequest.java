package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record RecetaInsumoRequest(
    @NotNull Long productoInsumoId,
    @NotNull @DecimalMin(value = "0.0001", inclusive = true) BigDecimal cantidad) {}
