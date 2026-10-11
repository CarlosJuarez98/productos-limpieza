package com.productoslimpieza.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PedidoAbonoDto(
    Long id,
    Long pedidoId,
    LocalDate fecha,
    BigDecimal monto,
    String nota,
    boolean conDineroPropio,
    /** Código del apartado gastado (PRODUCTOS, SALARIOS…); null si fue mi dinero. */
    String categoriaApartado
) {}
