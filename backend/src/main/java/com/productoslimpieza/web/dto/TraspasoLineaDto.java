package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record TraspasoLineaDto(
    Long id,
    Long productoId,
    String productoNombre,
    BigDecimal cantidad,
    BigDecimal precioCompra,
    BigDecimal total
) {}
