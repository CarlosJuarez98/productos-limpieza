package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Resumen del periodo cerrado en una fecha de corte. */
public record CortePeriodoDto(
    LocalDate fechaCorte,
    LocalDate periodoDesde,
    LocalDate periodoHasta,
    BigDecimal fondoInicial,
    BigDecimal totalVendidoProductos,
    BigDecimal totalRecargas,
    BigDecimal totalPagoServicios,
    BigDecimal totalIngresos,
    BigDecimal totalRetiros,
    BigDecimal totalTransferencias,
    BigDecimal totalRetirosTransferencia,
    BigDecimal totalApartadosProductos,
    BigDecimal totalApartadosServicios,
    BigDecimal totalCaja,
    BigDecimal totalTransferenciasNetas,
    BigDecimal totalNegocio,
    /** Contado guardado al marcar el corte (si hubo); null = no registrado. */
    BigDecimal totalCalculadora,
    /** Calculadora − total caja; null si no hay contado. */
    BigDecimal diferencia,
    /** Contado − fondo que queda (= lo que corresponde apartar). */
    BigDecimal paraApartar,
    List<MovimientoCajaDto> retiros,
    List<MovimientoCajaDto> ingresos,
    List<MovimientoCajaDto> retirosTransferencia,
    List<MovimientoCajaDto> transferencias
) {}
