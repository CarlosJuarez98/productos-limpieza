package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.TipoMovimientoCaja;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CajaResumenDto(
    LocalDate fechaInicio,
    LocalDate fechaFin,
    BigDecimal fondoInicial,
    BigDecimal totalVendidoProductos,
    BigDecimal totalRecargas,
    BigDecimal totalPagoServicios,
    BigDecimal totalRetiros,
    BigDecimal totalIngresos,
    BigDecimal totalRetirosTransferencia,
    BigDecimal totalTransferencias,
    BigDecimal totalCaja,
    BigDecimal totalTransferenciasNetas,
    BigDecimal totalNegocio,
    List<MovimientoCajaDto> retiros,
    List<MovimientoCajaDto> ingresos,
    List<MovimientoCajaDto> retirosTransferencia,
    List<MovimientoCajaDto> transferencias
) {}
