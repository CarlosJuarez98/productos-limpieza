package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PrestamoAdminRequest(
    @NotNull LocalDate fecha,
    @NotNull @Positive BigDecimal monto,
    /** PRESTAMO o DEVOLUCION */
    @NotBlank String tipo,
    String nota,
    /** Obligatorio en DEVOLUCION: de qué apartado sale el pago al admin. */
    String categoria
) {}
