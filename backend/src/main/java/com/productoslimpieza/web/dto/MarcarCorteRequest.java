package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MarcarCorteRequest(
    @NotNull LocalDate fechaCorte,
    /** Fondo del periodo nuevo (día siguiente al corte). */
    BigDecimal fondoInicial,
    /** Efectivo contado al cerrar (opcional; sirve para guardar faltante/sobrante). */
    BigDecimal totalCalculadora,
    /** Fondo con el que corrió el periodo que se cierra (si null, usa el de config). */
    BigDecimal fondoPeriodo
) {}
