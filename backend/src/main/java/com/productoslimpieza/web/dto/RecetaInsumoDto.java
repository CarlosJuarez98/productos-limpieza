package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record RecetaInsumoDto(Long productoInsumoId, String productoInsumoNombre, BigDecimal cantidad) {}
