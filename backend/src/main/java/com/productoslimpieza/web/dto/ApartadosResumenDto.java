package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.CategoriaApartado;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record ApartadosResumenDto(
    /** Saldo actual por categoría: ingresos − gastos. */
    Map<CategoriaApartado, BigDecimal> totales,
    Map<CategoriaApartado, BigDecimal> ingresos,
    Map<CategoriaApartado, BigDecimal> gastos,
    List<ApartadoDto> movimientos
) {}
