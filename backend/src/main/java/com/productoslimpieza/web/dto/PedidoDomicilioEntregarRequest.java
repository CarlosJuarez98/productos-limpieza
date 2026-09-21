package com.productoslimpieza.web.dto;

import java.time.LocalDate;

/**
 * @param fecha fecha de la venta (hoy por defecto)
 * @param pagoTarjeta si true, las ventas van a banco (como en Ventas); si false, efectivo.
 */
public record PedidoDomicilioEntregarRequest(LocalDate fecha, Boolean pagoTarjeta) {}
