package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record TraspasoLineaRequest(
    @NotNull Long productoId,
    @NotNull @Positive BigDecimal cantidad,
    /** Si true: esta línea no genera deuda (precio 0). */
    Boolean muestra
) {}
