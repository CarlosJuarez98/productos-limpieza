package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EntradaRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoId,
    @NotNull @Positive BigDecimal cantidad,
    BigDecimal precioProveedor,
    boolean actualizarPrecioCompra,
    /** true = ligar a pedido abierto (si hay faltante). false = compra libre / oferta. */
    Boolean aplicarAPedido,
    Long pedidoId
) {}
