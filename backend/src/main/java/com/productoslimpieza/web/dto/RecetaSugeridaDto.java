package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record RecetaSugeridaDto(
    Long productoResultadoId,
    String productoResultadoNombre,
    Long productoInsumoId,
    String productoInsumoNombre,
    boolean encontrada,
    BigDecimal cantidadProducto,
    BigDecimal cantidadAgua,
    BigDecimal cantidadInsumo,
    BigDecimal ratioInsumo,
    List<RecetaInsumoDto> insumos) {}
