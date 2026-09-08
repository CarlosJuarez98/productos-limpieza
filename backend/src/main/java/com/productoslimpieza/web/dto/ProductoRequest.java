package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.UnidadVenta;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ProductoRequest(
    @NotBlank String nombre,
    BigDecimal precioCompra,
    BigDecimal cantidadInicial,
    BigDecimal precioVenta,
    LocalDate fechaVigenciaPrecio,
    BigDecimal precioMayoreo5,
    BigDecimal precioMayoreo10,
    UnidadVenta vendePor
) {}
