package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record RecetaConfigDto(
    BigDecimal cloroProducto,
    BigDecimal cloroAgua,
    BigDecimal cloroInsumo,
    BigDecimal fabulosoProducto,
    BigDecimal fabulosoAgua,
    BigDecimal fabulosoInsumo) {}
