package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoRequest(
    LocalDate fecha,
    LocalDate periodoDesde,
    LocalDate periodoHasta,
    Integer diasCobertura,
    BigDecimal porcentajeExtra,
    String nota,
    @NotEmpty @Valid List<PedidoItemRequest> items
) {}
