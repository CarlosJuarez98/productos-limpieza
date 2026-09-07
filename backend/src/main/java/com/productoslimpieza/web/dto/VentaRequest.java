package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoVenta;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record VentaRequest(
    @NotNull LocalDate fecha,
    Long productoId,
    @NotNull TipoVenta tipoVenta,
    @NotNull BigDecimal cantidad,
    /** Obligatorio en mayoreo: total cobrado. En otros tipos se ignora. */
    BigDecimal total
) {}
