package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PrestamoAdminDto(
    Long id,
    LocalDate fecha,
    BigDecimal monto,
    String tipo,
    String nota,
    Long pedidoId,
    Long pedidoAbonoId,
    String categoria
) {}
