package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TraspasoAbonoRequest(
    @NotNull LocalDate fecha,
    @NotNull @Positive BigDecimal monto,
    String persona,
    String nota
) {}
