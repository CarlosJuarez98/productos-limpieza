package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record TraspasoRequest(
    @NotNull LocalDate fecha,
    @NotBlank String persona,
    String nota,
    @NotEmpty @Valid List<TraspasoLineaRequest> lineas
) {}
