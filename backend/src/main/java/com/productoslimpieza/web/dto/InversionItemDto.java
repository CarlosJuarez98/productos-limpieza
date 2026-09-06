package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record InversionItemDto(
    Long id,
    String tipo,
    String concepto,
    BigDecimal cantidad,
    BigDecimal precioUnidad,
    BigDecimal monto
) {}
