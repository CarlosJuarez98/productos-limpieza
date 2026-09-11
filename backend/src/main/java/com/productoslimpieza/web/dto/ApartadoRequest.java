package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoApartado;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ApartadoRequest(
    @NotNull LocalDate fecha,
    @NotBlank String categoria,
    @NotNull BigDecimal ingreso,
    TipoMovimientoApartado tipo,
    String motivo) {}
