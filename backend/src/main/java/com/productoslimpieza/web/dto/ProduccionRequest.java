package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ProduccionRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoResultadoId,
    @NotNull @Positive BigDecimal cantidadResultado,
    @Valid List<ProduccionInsumoRequest> insumos,
    /** Compat: un solo insumo si no mandan la lista. */
    Long productoInsumoId,
    @Positive BigDecimal cantidadInsumo) {}
