package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.CategoriaApartado;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ApartadoRequest(
    @NotNull LocalDate fecha,
    @NotNull CategoriaApartado categoria,
    @NotNull BigDecimal ingreso
) {}
