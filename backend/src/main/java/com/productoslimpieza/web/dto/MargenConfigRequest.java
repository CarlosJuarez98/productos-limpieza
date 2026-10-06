package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record MargenConfigRequest(
    @NotNull BigDecimal porcentajeMin,
    @NotNull BigDecimal porcentajeMax,
    /** Descuento % sobre menudeo para ≥5 L; null = sin configurar. */
    BigDecimal porcentajeMayoreo5,
    /** Descuento % sobre menudeo para ≥10 L; null = sin configurar. */
    BigDecimal porcentajeMayoreo10
) {}
