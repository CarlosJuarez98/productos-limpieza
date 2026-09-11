package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoDto(
    Long id,
    LocalDate fecha,
    String estado,
    LocalDate periodoDesde,
    LocalDate periodoHasta,
    Integer diasCobertura,
    BigDecimal porcentajeExtra,
    String nota,
    int totalItems,
    int itemsConFalta,
    List<PedidoItemDto> items
) {}
