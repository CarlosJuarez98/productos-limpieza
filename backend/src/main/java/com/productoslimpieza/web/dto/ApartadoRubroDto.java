package com.productoslimpieza.web.dto;

public record ApartadoRubroDto(
    Long id, String codigo, String nombre, boolean activo, int orden, boolean liquidaCorte) {}
