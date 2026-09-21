package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoVenta;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PedidoDomicilioItemRequest(
    Long productoId,
    @NotNull TipoVenta tipoVenta,
    @NotNull BigDecimal cantidad,
    BigDecimal total,
    Boolean pagoTarjeta) {}
