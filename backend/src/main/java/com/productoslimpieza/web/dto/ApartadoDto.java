package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.CategoriaApartado;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record ApartadoDto(
    Long id,
    LocalDate fecha,
    CategoriaApartado categoria,
    BigDecimal ingreso
) {}
