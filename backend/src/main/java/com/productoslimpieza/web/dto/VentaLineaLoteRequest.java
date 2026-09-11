package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoVenta;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** Línea de un lote de ventas (la fecha va en el lote). */
public record VentaLineaLoteRequest(
    Long productoId,
    @NotNull TipoVenta tipoVenta,
    @NotNull BigDecimal cantidad,
    BigDecimal total
) {}
