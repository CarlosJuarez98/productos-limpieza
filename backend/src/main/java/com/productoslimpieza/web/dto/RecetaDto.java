package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record RecetaDto(
    Long id,
    Long productoResultadoId,
    String productoResultadoNombre,
    Long productoInsumoId,
    String productoInsumoNombre,
    BigDecimal cantidadProducto,
    BigDecimal cantidadAgua,
    BigDecimal cantidadInsumo,
    List<RecetaInsumoDto> insumos) {}
