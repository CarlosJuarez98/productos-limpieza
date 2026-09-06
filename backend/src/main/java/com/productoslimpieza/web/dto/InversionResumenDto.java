package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record InversionResumenDto(
    BigDecimal totalProductos,
    BigDecimal totalInfraestructura,
    BigDecimal inversionTotal,
    List<InversionItemDto> items
) {}
