package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;

public record PersonaRequest(@NotBlank String nombre) {}
