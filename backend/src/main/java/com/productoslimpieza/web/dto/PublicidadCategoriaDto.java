package com.productoslimpieza.web.dto;

import java.util.List;

/** Categoría editable para armar publicidad (productos del inventario, N:N). */
public record PublicidadCategoriaDto(
    String id,
    String nombre,
    /** LIMPIEZA o JARCERIA */
    String departamento,
    /** IDs de productos del inventario (un producto puede estar en varias categorías). */
    List<Long> productoIds,
    /** Eslogan opcional del flyer. */
    String slogan,
    /** URL de imagen realista (upload o /publicidad/…). */
    String imagenSrc,
    boolean imagenCustom,
    int orden
) {}
