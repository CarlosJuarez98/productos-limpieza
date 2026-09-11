package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoSugeridoDto(
    LocalDate desde,
    LocalDate hasta,
    int diasObservados,
    int diasCobertura,
    BigDecimal porcentajeExtra,
    List<PedidoLineaDto> lineas,
    List<InsumoAlertaDto> alertasInsumos
) {}
