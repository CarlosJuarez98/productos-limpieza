package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ProduccionRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoResultadoId,
    @NotNull @Positive BigDecimal cantidadResultado,
    @NotNull Long productoInsumoId,
    @NotNull @Positive BigDecimal cantidadInsumo
) {}
