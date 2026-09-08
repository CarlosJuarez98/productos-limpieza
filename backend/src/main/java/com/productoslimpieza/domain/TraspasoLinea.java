package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "traspaso_lineas")
public class TraspasoLinea {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "traspaso_id", nullable = false)
  private Traspaso traspaso;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_id", nullable = false)
  private Producto producto;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal precioCompra;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal total;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Traspaso getTraspaso() { return traspaso; }
  public void setTraspaso(Traspaso traspaso) { this.traspaso = traspaso; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public BigDecimal getCantidad() { return cantidad; }
  public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
  public BigDecimal getPrecioCompra() { return precioCompra; }
  public void setPrecioCompra(BigDecimal precioCompra) { this.precioCompra = precioCompra; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
}
