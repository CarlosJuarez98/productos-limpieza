package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TraspasoDto(
    Long id,
    LocalDate fecha,
    Long productoId,
    String productoNombre,
    BigDecimal cantidad,
    BigDecimal precioCompra,
    BigDecimal total,
    String persona,
    String nota
) {}
