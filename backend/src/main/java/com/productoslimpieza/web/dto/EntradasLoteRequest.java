package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record EntradasLoteRequest(
    @NotNull LocalDate fecha,
    boolean actualizarPrecioCompra,
    @NotEmpty @Valid List<EntradaLineaRequest> lineas
) {}
