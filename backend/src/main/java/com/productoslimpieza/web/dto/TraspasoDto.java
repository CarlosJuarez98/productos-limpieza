package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TraspasoDto(
    Long id,
    LocalDate fecha,
    Long personaId,
    String persona,
    String nota,
    BigDecimal total,
    List<TraspasoLineaDto> lineas
) {}
