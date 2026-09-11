package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record RecetaConfigRequest(
    @NotNull @DecimalMin("0.0001") BigDecimal cloroProducto,
    @NotNull @DecimalMin("0") BigDecimal cloroAgua,
    @NotNull @DecimalMin("0.0001") BigDecimal cloroInsumo,
    @NotNull @DecimalMin("0.0001") BigDecimal fabulosoProducto,
    @NotNull @DecimalMin("0") BigDecimal fabulosoAgua,
    @NotNull @DecimalMin("0.0001") BigDecimal fabulosoInsumo) {}
