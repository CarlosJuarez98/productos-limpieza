package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ProduccionDto(
    Long id,
    LocalDate fecha,
    Long productoResultadoId,
    String productoResultadoNombre,
    BigDecimal cantidadResultado,
    Long productoInsumoId,
    String productoInsumoNombre,
    BigDecimal cantidadInsumo
) {}
