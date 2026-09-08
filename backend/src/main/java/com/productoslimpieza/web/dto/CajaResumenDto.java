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
    /** Fondo + ventas + ingresos + retiros del banco − retiros − transferencias − apartados */
    BigDecimal totalCaja,
    /** Saldo en banco global: todas las transferencias − todos los retiros transferencia */
    BigDecimal totalTransferenciasNetas,
    /** Efectivo del periodo + saldo en banco (global). */
    BigDecimal totalNegocio,
    /** Fechas de corte registradas en BD. */
    List<LocalDate> fechasCorte,
    /** Último corte marcado (= día anterior al inicio del periodo). */
    LocalDate fechaUltimoCorte,
    /**
     * Sobrante del último corte (contado − fondo) a repartir en apartados.
     * Solo viene del corte; no crece con ventas del periodo nuevo.
     */
    BigDecimal paraApartarUltimoCorte,
    /** Ingresos a apartados (productos/casa/salarios) ya registrados tras ese corte. */
    BigDecimal yaApartadoDesdeUltimoCorte,
    /**
     * Lo que aún falta por apartar del último corte
     * ({@code paraApartarUltimoCorte − yaApartadoDesdeUltimoCorte}).
     */
    BigDecimal disponibleParaApartar,
    List<MovimientoCajaDto> retiros,
    List<MovimientoCajaDto> ingresos,
    /** Todos los retiros del banco (histórico global). */
    List<MovimientoCajaDto> retirosTransferencia,
    /** Todas las transferencias a banco (histórico global). */
    List<MovimientoCajaDto> transferencias
) {}
