package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record TraspasoSaldoPersonaDto(
    Long personaId,
    String persona,
    BigDecimal totalTraspasado,
    BigDecimal totalAbonado,
    BigDecimal saldo,
    /** DEBE | AL_CORRIENTE | A_FAVOR */
    String estado
) {}
