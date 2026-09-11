package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record AjusteInventarioRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoId,
    @NotNull BigDecimal cantidad,
    @NotBlank String motivo
) {}
