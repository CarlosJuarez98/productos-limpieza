package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoCaja;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MovimientoCajaRequest(
    @NotNull LocalDate fecha,
    @NotNull TipoMovimientoCaja tipo,
    @NotNull BigDecimal monto,
    String motivo
) {}
