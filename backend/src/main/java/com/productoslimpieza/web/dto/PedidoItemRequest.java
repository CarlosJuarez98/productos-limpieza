package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record PedidoItemRequest(
    @NotNull Long productoId,
    @NotNull @Positive BigDecimal cantidad
) {}
