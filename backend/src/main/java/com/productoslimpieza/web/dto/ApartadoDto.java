package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ApartadoDto(
    Long id,
    LocalDate fecha,
    CategoriaApartado categoria,
    BigDecimal ingreso,
    TipoMovimientoApartado tipo,
    String motivo
) {}
