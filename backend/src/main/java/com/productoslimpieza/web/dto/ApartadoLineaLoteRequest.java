package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoApartado;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record ApartadoLineaLoteRequest(
    @NotBlank String categoria,
    @NotNull BigDecimal ingreso,
    TipoMovimientoApartado tipo,
    String motivo) {}
