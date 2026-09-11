package com.productoslimpieza.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record PedidoRecepcionRequest(
    @NotEmpty @Valid List<Linea> lineas
) {
  public record Linea(
      @NotNull Long itemId,
      @NotNull BigDecimal cantidadRecibida,
      /** Precio unitario del proveedor; si viene, se usa en la entrada y actualiza compra. */
      BigDecimal precioProveedor
  ) {}
}
