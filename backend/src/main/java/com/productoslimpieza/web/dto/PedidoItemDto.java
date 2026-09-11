package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record PedidoItemDto(
    Long id,
    Long productoId,
    String productoNombre,
    String vendePor,
    String vendePorLabel,
    BigDecimal cantidadPedida,
    BigDecimal cantidadRecibida,
    BigDecimal cantidadFaltante,
    /** Precio de compra actual del producto (para precargar al recibir). */
    BigDecimal precioCompra
) {}
