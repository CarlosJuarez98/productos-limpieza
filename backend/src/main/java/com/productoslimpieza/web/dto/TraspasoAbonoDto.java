package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TraspasoAbonoDto(
    Long id,
    LocalDate fecha,
    BigDecimal monto,
    String persona,
    String nota
) {}
