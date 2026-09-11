package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;

public record ApartadoRubroRequest(@NotBlank String nombre) {}
