package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record ApartadosResumenDto(
    List<ApartadoRubroDto> rubros,
    /** Saldo actual por código de rubro: ingresos − gastos. */
    Map<String, BigDecimal> totales,
    Map<String, BigDecimal> ingresos,
    Map<String, BigDecimal> gastos,
    List<ApartadoDto> movimientos) {}
