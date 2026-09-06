package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PrecioHistoricoRequest(
    @NotNull Long productoId,
    @NotNull LocalDate fechaVigencia,
    @NotNull BigDecimal precio
) {}
