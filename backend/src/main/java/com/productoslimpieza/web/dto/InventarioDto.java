package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.UnidadVenta;
import java.math.BigDecimal;

public record InventarioDto(
    Long id,
    String nombre,
    BigDecimal precioVentaHoy,
    BigDecimal precioMayoreo5,
    BigDecimal precioMayoreo10,
    BigDecimal precioCompra,
    BigDecimal precioMinimoSugerido,
    BigDecimal precioMaximoSugerido,
    BigDecimal cantidadInicial,
    BigDecimal stockActual,
    BigDecimal utilizadoEnCasa,
    BigDecimal utilizadoEnCasaMonto,
    BigDecimal porcentajeGanancia,
    boolean precioVentaBajoMinimo,
    UnidadVenta vendePor,
    String vendePorLabel
) {}
