package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "inversion_items")
public class InversionItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 30)
  private String tipo; // PRODUCTO | INFRAESTRUCTURA

  @Column(nullable = false, length = 200)
  private String concepto;

  @Column(precision = 14, scale = 4)
  private BigDecimal cantidad;

  @Column(precision = 14, scale = 4)
  private BigDecimal precioUnidad;

  @Column(precision = 14, scale = 4)
  private BigDecimal monto;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getTipo() { return tipo; }
  public void setTipo(String tipo) { this.tipo = tipo; }
  public String getConcepto() { return concepto; }
  public void setConcepto(String concepto) { this.concepto = concepto; }
  public BigDecimal getCantidad() { return cantidad; }
  public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
  public BigDecimal getPrecioUnidad() { return precioUnidad; }
  public void setPrecioUnidad(BigDecimal precioUnidad) { this.precioUnidad = precioUnidad; }
  public BigDecimal getMonto() { return monto; }
  public void setMonto(BigDecimal monto) { this.monto = monto; }
}
