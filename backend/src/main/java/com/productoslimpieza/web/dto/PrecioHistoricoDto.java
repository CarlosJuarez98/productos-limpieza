package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PrecioHistoricoDto(
    Long id,
    Long productoId,
    String productoNombre,
    LocalDate fechaVigencia,
    BigDecimal precio
) {}
