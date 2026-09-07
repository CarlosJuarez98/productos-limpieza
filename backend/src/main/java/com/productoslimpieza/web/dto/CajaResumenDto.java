package com.productoslimpieza.web.dto;

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
    BigDecimal totalApartadosProductos,
    BigDecimal totalApartadosServicios,
    /** Fondo + ventas + ingresos − retiros − transferencias − apartados */
    BigDecimal totalCaja,
    /** Transferencias − retiros transferencia */
    BigDecimal totalTransferenciasNetas,
    /** Total caja + transferencias netas (debe acercarse al efectivo contado) */
    BigDecimal totalNegocio,
    /** Fechas de corte registradas en BD. */
    List<LocalDate> fechasCorte,
    /** Último corte marcado (= día anterior al inicio del periodo). */
    LocalDate fechaUltimoCorte,
    List<MovimientoCajaDto> retiros,
    List<MovimientoCajaDto> ingresos,
    List<MovimientoCajaDto> retirosTransferencia,
    List<MovimientoCajaDto> transferencias
) {}
