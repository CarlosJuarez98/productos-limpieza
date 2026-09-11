package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "producciones")
public class Produccion extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_resultado_id", nullable = false)
  private Producto productoResultado;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidadResultado;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_insumo_id", nullable = false)
  private Producto productoInsumo;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidadInsumo;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public Producto getProductoResultado() { return productoResultado; }
  public void setProductoResultado(Producto productoResultado) { this.productoResultado = productoResultado; }
  public BigDecimal getCantidadResultado() { return cantidadResultado; }
  public void setCantidadResultado(BigDecimal cantidadResultado) { this.cantidadResultado = cantidadResultado; }
  public Producto getProductoInsumo() { return productoInsumo; }
  public void setProductoInsumo(Producto productoInsumo) { this.productoInsumo = productoInsumo; }
  public BigDecimal getCantidadInsumo() { return cantidadInsumo; }
  public void setCantidadInsumo(BigDecimal cantidadInsumo) { this.cantidadInsumo = cantidadInsumo; }
}
