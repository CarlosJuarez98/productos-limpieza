package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record TraspasosResumenDto(
    BigDecimal totalTraspasado,
    BigDecimal totalAbonado,
    BigDecimal saldoPendiente,
    List<TraspasoDto> traspasos,
    List<TraspasoAbonoDto> abonos
) {}
