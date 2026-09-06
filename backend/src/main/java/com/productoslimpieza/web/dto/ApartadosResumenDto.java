package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.CategoriaApartado;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record ApartadosResumenDto(
    Map<CategoriaApartado, BigDecimal> totales,
    List<ApartadoDto> movimientos
) {}
