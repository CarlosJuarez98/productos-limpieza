package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Inversión inicial = dinero que metieron al arrancar (productos base + infraestructura).
 * Reinversión = compras posteriores / stock de alta (sale de las ganancias; no cuenta para
 * “¿ya recuperé lo inicial?”).
 * Ganancia bruta = ventas − costo de compra de lo vendido (al día de hoy).
 * Recuperación inicial = ventas de producto − inversión inicial.
 */
public record InversionResumenDto(
    /** Ítems PRODUCTO manuales = mercancía de la inversión inicial. */
    BigDecimal totalProductosIniciales,
    BigDecimal totalInfraestructura,
    /** Productos iniciales + infraestructura. */
    BigDecimal inversionInicial,
    /** cantidadInicial × precioCompra de productos (altas posteriores / stock). */
    BigDecimal totalStockAlta,
    /** Entradas de proveedor (compras con lo ganado). */
    BigDecimal totalEntradas,
    /** Stock alta + entradas. */
    BigDecimal totalReinversion,
    /** Solo ventas de producto. */
    BigDecimal totalVentas,
    /** Ventas de producto − inversión inicial. */
    BigDecimal retornoSobreInicial,
    boolean inversionInicialRecuperada,
    BigDecimal faltantePorRecuperarInicial,
    BigDecimal gananciaSobreInicial,
    /** Costo estimado de lo vendido (precio compra × unidades), al día de hoy. */
    BigDecimal costoMercanciaVendida,
    /** Ventas − costo de mercancía (todas las ventas de producto hasta hoy). */
    BigDecimal gananciaBruta,
    /** % de ganancia bruta sobre ventas. */
    BigDecimal margenPorcentaje,
    List<InversionItemDto> items
) {}
