package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record RecetaRequest(
    @NotNull Long productoResultadoId,
    @NotNull @DecimalMin(value = "0.0001", inclusive = true) BigDecimal cantidadProducto,
    @NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal cantidadAgua,
    /** Preferido: uno o más insumos. */
    @Valid List<RecetaInsumoRequest> insumos,
    /** Compat: un solo insumo si no mandan la lista. */
    Long productoInsumoId,
    @DecimalMin(value = "0.0001", inclusive = true) BigDecimal cantidadInsumo) {}
