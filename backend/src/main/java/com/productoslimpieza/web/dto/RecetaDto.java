package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record RecetaDto(
    Long id,
    Long productoResultadoId,
    String productoResultadoNombre,
    Long productoInsumoId,
    String productoInsumoNombre,
    BigDecimal cantidadProducto,
    BigDecimal cantidadAgua,
    BigDecimal cantidadInsumo) {}
