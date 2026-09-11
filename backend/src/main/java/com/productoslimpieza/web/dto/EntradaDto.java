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
    /** Precio de la última compra previa (o precio compra inventario si no hay). */
    BigDecimal precioCompraAnterior,
    boolean precioMayor,
    boolean precioMenor,
    Long pedidoId,
    boolean aplicadaAPedido
) {}
