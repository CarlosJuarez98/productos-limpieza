package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record PrestamoAdminResumenDto(
    /** Cuánto le debe el negocio al admin (préstamos − devoluciones). */
    BigDecimal saldo,
    BigDecimal totalPrestamos,
    BigDecimal totalDevoluciones,
    List<PrestamoAdminDto> movimientos
) {}
