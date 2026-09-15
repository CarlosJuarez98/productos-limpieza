package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "produccion_insumos")
public class ProduccionInsumo extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "produccion_id", nullable = false)
  private Produccion produccion;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_insumo_id", nullable = false)
  private Producto producto;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Produccion getProduccion() {
    return produccion;
  }

  public void setProduccion(Produccion produccion) {
    this.produccion = produccion;
  }

  public Producto getProducto() {
    return producto;
  }

  public void setProducto(Producto producto) {
    this.producto = producto;
  }

  public BigDecimal getCantidad() {
    return cantidad;
  }

  public void setCantidad(BigDecimal cantidad) {
    this.cantidad = cantidad;
  }
}
