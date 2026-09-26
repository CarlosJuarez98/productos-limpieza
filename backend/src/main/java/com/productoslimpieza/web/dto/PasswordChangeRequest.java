package com.productoslimpieza.web.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordChangeRequest(@NotBlank String actual, @NotBlank String nueva) {}
