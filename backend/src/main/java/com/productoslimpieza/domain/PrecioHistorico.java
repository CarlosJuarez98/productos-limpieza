package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "precios_historicos",
    indexes = @Index(name = "idx_precio_prod_fecha", columnList = "producto_id, fechaVigencia"))
public class PrecioHistorico {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto producto;

  @Column(nullable = false)
  private LocalDate fechaVigencia;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal precio;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public LocalDate getFechaVigencia() { return fechaVigencia; }
  public void setFechaVigencia(LocalDate fechaVigencia) { this.fechaVigencia = fechaVigencia; }
  public BigDecimal getPrecio() { return precio; }
  public void setPrecio(BigDecimal precio) { this.precio = precio; }
}
