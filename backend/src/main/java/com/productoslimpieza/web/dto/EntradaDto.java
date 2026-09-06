package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EntradaDto(
    Long id,
    LocalDate fecha,
    Long productoId,
    String productoNombre,
    BigDecimal cantidad,
    BigDecimal precioProveedor,
    BigDecimal total,
    BigDecimal precioCompraAnterior,
    boolean precioMayor
) {}
