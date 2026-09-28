package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record ArmadoDto(
    Long productoId,
    String productoNombre,
    BigDecimal cantidadArmada,
    BigDecimal bastonesUsados,
    Long bastonProductoId,
    String bastonNombre,
    BigDecimal pendienteArmarRestante,
    BigDecimal precioCompraActualizado
) {}
