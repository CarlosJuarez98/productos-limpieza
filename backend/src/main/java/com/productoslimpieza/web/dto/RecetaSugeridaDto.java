package com.productoslimpieza.web.dto;

public record RecetaSugeridaDto(
    Long productoResultadoId,
    String productoResultadoNombre,
    Long productoInsumoId,
    String productoInsumoNombre,
    boolean encontrada
) {}
