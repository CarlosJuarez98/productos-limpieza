package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "pedido_domicilio_items")
public class PedidoDomicilioItem extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "pedido_id", nullable = false)
  private PedidoDomicilio pedido;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto producto;

  @Enumerated(EnumType.STRING)
  @Column(name = "tipo_venta", nullable = false, length = 40)
  private TipoVenta tipoVenta;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal total = BigDecimal.ZERO;

  @Column(name = "pago_tarjeta", nullable = false)
  private boolean pagoTarjeta = false;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public PedidoDomicilio getPedido() {
    return pedido;
  }

  public void setPedido(PedidoDomicilio pedido) {
    this.pedido = pedido;
  }

  public Producto getProducto() {
    return producto;
  }

  public void setProducto(Producto producto) {
    this.producto = producto;
  }

  public TipoVenta getTipoVenta() {
    return tipoVenta;
  }

  public void setTipoVenta(TipoVenta tipoVenta) {
    this.tipoVenta = tipoVenta;
  }

  public BigDecimal getCantidad() {
    return cantidad;
  }

  public void setCantidad(BigDecimal cantidad) {
    this.cantidad = cantidad;
  }

  public BigDecimal getTotal() {
    return total;
  }

  public void setTotal(BigDecimal total) {
    this.total = total;
  }

  public boolean isPagoTarjeta() {
    return pagoTarjeta;
  }

  public void setPagoTarjeta(boolean pagoTarjeta) {
    this.pagoTarjeta = pagoTarjeta;
  }
}
