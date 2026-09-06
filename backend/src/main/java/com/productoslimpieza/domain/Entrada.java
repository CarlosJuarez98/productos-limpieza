package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "entradas")
public class Entrada {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto producto;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  @Column(precision = 14, scale = 4)
  private BigDecimal precioProveedor;

  @Column(precision = 14, scale = 4)
  private BigDecimal total;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public BigDecimal getCantidad() { return cantidad; }
  public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
  public BigDecimal getPrecioProveedor() { return precioProveedor; }
  public void setPrecioProveedor(BigDecimal precioProveedor) { this.precioProveedor = precioProveedor; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
}
