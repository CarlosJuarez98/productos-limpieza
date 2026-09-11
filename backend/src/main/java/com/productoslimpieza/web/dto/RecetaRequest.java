package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record RecetaRequest(
    @NotNull Long productoResultadoId,
    @NotNull Long productoInsumoId,
    @NotNull @DecimalMin(value = "0.0001", inclusive = true) BigDecimal cantidadProducto,
    @NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal cantidadAgua,
    @NotNull @DecimalMin(value = "0.0001", inclusive = true) BigDecimal cantidadInsumo) {}
