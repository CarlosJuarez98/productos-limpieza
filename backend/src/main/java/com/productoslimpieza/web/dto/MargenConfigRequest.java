package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record MargenConfigRequest(
    @NotNull BigDecimal porcentajeMin,
    @NotNull BigDecimal porcentajeMax,
    @NotNull BigDecimal porcentajeMayoreo5,
    @NotNull BigDecimal porcentajeMayoreo10
) {}
