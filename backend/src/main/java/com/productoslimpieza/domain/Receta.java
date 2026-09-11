package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "recetas",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_receta_resultado_tenant",
            columnNames = {"tenant_id", "producto_resultado_id"}))
public class Receta extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_resultado_id", nullable = false)
  private Producto productoResultado;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "producto_insumo_id", nullable = false)
  private Producto productoInsumo;

  /** Ej. 5 L de producto = agua + insumo. */
  @Column(name = "cantidad_producto", nullable = false, precision = 12, scale = 4)
  private BigDecimal cantidadProducto;

  @Column(name = "cantidad_agua", nullable = false, precision = 12, scale = 4)
  private BigDecimal cantidadAgua;

  @Column(name = "cantidad_insumo", nullable = false, precision = 12, scale = 4)
  private BigDecimal cantidadInsumo;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Producto getProductoResultado() {
    return productoResultado;
  }

  public void setProductoResultado(Producto productoResultado) {
    this.productoResultado = productoResultado;
  }

  public Producto getProductoInsumo() {
    return productoInsumo;
  }

  public void setProductoInsumo(Producto productoInsumo) {
    this.productoInsumo = productoInsumo;
  }

  public BigDecimal getCantidadProducto() {
    return cantidadProducto;
  }

  public void setCantidadProducto(BigDecimal cantidadProducto) {
    this.cantidadProducto = cantidadProducto;
  }

  public BigDecimal getCantidadAgua() {
    return cantidadAgua;
  }

  public void setCantidadAgua(BigDecimal cantidadAgua) {
    this.cantidadAgua = cantidadAgua;
  }

  public BigDecimal getCantidadInsumo() {
    return cantidadInsumo;
  }

  public void setCantidadInsumo(BigDecimal cantidadInsumo) {
    this.cantidadInsumo = cantidadInsumo;
  }
}
