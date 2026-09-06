package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoCaja;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MovimientoCajaDto(
    Long id,
    LocalDate fecha,
    TipoMovimientoCaja tipo,
    BigDecimal monto,
    String motivo
) {}
