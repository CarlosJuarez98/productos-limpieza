package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record InsumoAlertaDto(
    Long productoInsumoId,
    String productoInsumoNombre,
    Long productoResultadoId,
    String productoResultadoNombre,
    BigDecimal stockInsumo,
    BigDecimal stockResultado,
    BigDecimal sugeridoPedir,
    String motivo
) {}
