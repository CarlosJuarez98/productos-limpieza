package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AjusteInventarioDto(
    Long id,
    LocalDate fecha,
    Long productoId,
    String productoNombre,
    BigDecimal cantidad,
    String motivo
) {}
