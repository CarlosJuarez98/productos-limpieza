package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CajaConfigRequest(
    LocalDate fechaInicio,
    LocalDate fechaFin,
    BigDecimal fondoInicial
) {}
