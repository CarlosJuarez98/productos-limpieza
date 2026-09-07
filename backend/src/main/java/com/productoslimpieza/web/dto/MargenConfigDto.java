package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record MargenConfigDto(
    BigDecimal margenMin,
    BigDecimal margenMax,
    BigDecimal margenMayoreo5,
    BigDecimal margenMayoreo10,
    BigDecimal porcentajeMin,
    BigDecimal porcentajeMax,
    BigDecimal porcentajeMayoreo5,
    BigDecimal porcentajeMayoreo10
) {}
