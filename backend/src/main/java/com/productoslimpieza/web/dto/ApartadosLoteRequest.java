package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record ApartadosLoteRequest(
    @NotNull LocalDate fecha,
    @NotEmpty @Valid List<ApartadoLineaLoteRequest> lineas) {}
