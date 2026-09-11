package com.productoslimpieza.web.dto;

import java.math.BigDecimal;

public record PedidoLineaDto(
    Long productoId,
    String productoNombre,
    String vendePor,
    String vendePorLabel,
    BigDecimal stockActual,
    /** Salida real en el periodo observado (ventas + traspasos + casa). */
    BigDecimal consumoObservado,
    /** Ritmo proyectado a los días de cobertura (p. ej. mes completo). */
    BigDecimal consumoBase,
    BigDecimal consumoConColchon,
    /** Faltante arrastrado de pedidos abiertos anteriores. */
    BigDecimal faltanteAnterior,
    BigDecimal sugerido
) {}
