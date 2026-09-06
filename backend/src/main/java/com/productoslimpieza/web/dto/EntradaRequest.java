package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EntradaRequest(
    @NotNull LocalDate fecha,
    @NotNull Long productoId,
    @NotNull BigDecimal cantidad,
    BigDecimal precioProveedor,
    boolean actualizarPrecioCompra
) {}
