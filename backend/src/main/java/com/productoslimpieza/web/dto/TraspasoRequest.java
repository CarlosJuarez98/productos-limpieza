package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TraspasoRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoId,
    @NotNull @Positive BigDecimal cantidad,
    String persona,
    String nota
) {}
