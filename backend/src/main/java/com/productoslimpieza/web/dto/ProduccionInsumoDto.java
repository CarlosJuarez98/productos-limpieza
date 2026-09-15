package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record ProduccionInsumoDto(
    Long productoInsumoId, String productoInsumoNombre, BigDecimal cantidad) {}
