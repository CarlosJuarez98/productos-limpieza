package com.productoslimpieza.web.dto;

/** Ítem de la galería Amorcas (publicidad). */
public record PublicidadGaleriaItemDto(
    String id,
    String titulo,
    String descripcion,
    /** URL para <img> (estática /publicidad/... o API de archivo subido). */
    String src,
    String textoShare,
    /** true = se puede borrar del disco de uploads; false = imagen base del proyecto. */
    boolean eliminable) {}
