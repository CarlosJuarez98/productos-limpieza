package com.productoslimpieza.web.dto;

import com.productoslimpieza.domain.EstadoPedidoDomicilio;
import com.productoslimpieza.domain.TipoVenta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PedidoDomicilioDto(
    Long id,
    LocalDate fecha,
    EstadoPedidoDomicilio estado,
    String cliente,
    String telefono,
    String nota,
    LocalDate fechaEntrega,
    BigDecimal total,
    List<Item> items) {

  public record Item(
      Long id,
      Long productoId,
      String productoNombre,
      TipoVenta tipoVenta,
      String tipoVentaLabel,
      BigDecimal cantidad,
      BigDecimal total,
      boolean pagoTarjeta) {}
}
