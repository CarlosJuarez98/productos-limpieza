package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoApartado;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ApartadoDto(
    Long id,
    LocalDate fecha,
    String categoria,
    BigDecimal ingreso,
    TipoMovimientoApartado tipo,
    String motivo) {}
