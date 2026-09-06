package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoVenta;
import java.math.BigDecimal;
import java.time.LocalDate;

public record VentaDto(
    Long id,
    LocalDate fecha,
    Long productoId,
    String productoNombre,
    TipoVenta tipoVenta,
    String tipoVentaLabel,
    BigDecimal cantidad,
    BigDecimal total
) {}
