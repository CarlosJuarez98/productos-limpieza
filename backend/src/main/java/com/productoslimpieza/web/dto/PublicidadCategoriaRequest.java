package com.productoslimpieza.web.dto;

import java.util.List;

public record PublicidadCategoriaRequest(
    String nombre,
    String departamento,
    List<Long> productoIds,
    String slogan,
    /** Ruta estática opcional, ej. /publicidad/prod-suavizante.jpg (si no hay upload). */
    String imagenEstatica,
    Integer orden
) {}
