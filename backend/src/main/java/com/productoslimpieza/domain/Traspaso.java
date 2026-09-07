package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "traspasos")
public class Traspaso {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_id", nullable = false)
  private Producto producto;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  /** Precio de compra al momento del traspaso */
  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal precioCompra;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal total;

  @Column(length = 120)
  private String persona;

  @Column(length = 255)
  private String nota;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public BigDecimal getCantidad() { return cantidad; }
  public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
  public BigDecimal getPrecioCompra() { return precioCompra; }
  public void setPrecioCompra(BigDecimal precioCompra) { this.precioCompra = precioCompra; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
  public String getPersona() { return persona; }
  public void setPersona(String persona) { this.persona = persona; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
}
