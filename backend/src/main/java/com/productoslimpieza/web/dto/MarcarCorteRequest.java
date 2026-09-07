package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MarcarCorteRequest(
    @NotNull LocalDate fechaCorte,
    BigDecimal fondoInicial,
    /** Efectivo contado al cerrar (opcional; sirve para guardar faltante/sobrante). */
    BigDecimal totalCalculadora
) {}
