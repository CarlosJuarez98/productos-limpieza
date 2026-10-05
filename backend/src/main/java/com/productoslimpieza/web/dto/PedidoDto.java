package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoDto(
    Long id,
    /** Contador visible 1, 2, 3… (no el id de BD). */
    Long numero,
    LocalDate fecha,
    String estado,
    LocalDate periodoDesde,
    LocalDate periodoHasta,
    Integer diasCobertura,
    BigDecimal porcentajeExtra,
    String nota,
    LocalDate fechaLimitePago,
    BigDecimal totalProveedor,
    BigDecimal totalPagado,
    BigDecimal saldoProveedor,
    int totalItems,
    int itemsConFalta,
    /** true si ya hay entradas (mercancía) ligadas; entonces no se puede “cancelar”, solo eliminar. */
    boolean tieneEntradas,
    List<PedidoItemDto> items,
    List<PedidoAbonoDto> abonos
) {}
