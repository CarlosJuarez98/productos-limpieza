package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "productos")
public class Producto {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 200)
  private String nombre;

  @Column(precision = 14, scale = 4)
  private BigDecimal precioCompra = BigDecimal.ZERO;

  @Column(precision = 14, scale = 4)
  private BigDecimal cantidadInicial = BigDecimal.ZERO;

  @Column(nullable = false)
  private boolean activo = true;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getNombre() { return nombre; }
  public void setNombre(String nombre) { this.nombre = nombre; }
  public BigDecimal getPrecioCompra() { return precioCompra; }
  public void setPrecioCompra(BigDecimal precioCompra) { this.precioCompra = precioCompra; }
  public BigDecimal getCantidadInicial() { return cantidadInicial; }
  public void setCantidadInicial(BigDecimal cantidadInicial) { this.cantidadInicial = cantidadInicial; }
  public boolean isActivo() { return activo; }
  public void setActivo(boolean activo) { this.activo = activo; }
}
