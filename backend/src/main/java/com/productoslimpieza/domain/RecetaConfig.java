package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "receta_config",
    uniqueConstraints = @UniqueConstraint(name = "uk_receta_config_tenant", columnNames = "tenant_id"))
public class RecetaConfig extends TenantEntity {

  @Id
  private Long id;

  /** Ej. 5 L Cloro = cloroAgua + cloroInsumo. */
  @Column(name = "cloro_producto", nullable = false, precision = 12, scale = 4)
  private BigDecimal cloroProducto = new BigDecimal("5");

  @Column(name = "cloro_agua", nullable = false, precision = 12, scale = 4)
  private BigDecimal cloroAgua = new BigDecimal("4");

  @Column(name = "cloro_insumo", nullable = false, precision = 12, scale = 4)
  private BigDecimal cloroInsumo = new BigDecimal("1");

  /** Ej. 16 L Fabuloso = fabulosoAgua + fabulosoInsumo. */
  @Column(name = "fabuloso_producto", nullable = false, precision = 12, scale = 4)
  private BigDecimal fabulosoProducto = new BigDecimal("16");

  @Column(name = "fabuloso_agua", nullable = false, precision = 12, scale = 4)
  private BigDecimal fabulosoAgua = new BigDecimal("15");

  @Column(name = "fabuloso_insumo", nullable = false, precision = 12, scale = 4)
  private BigDecimal fabulosoInsumo = new BigDecimal("1");

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public BigDecimal getCloroProducto() {
    return cloroProducto;
  }

  public void setCloroProducto(BigDecimal cloroProducto) {
    this.cloroProducto = cloroProducto;
  }

  public BigDecimal getCloroAgua() {
    return cloroAgua;
  }

  public void setCloroAgua(BigDecimal cloroAgua) {
    this.cloroAgua = cloroAgua;
  }

  public BigDecimal getCloroInsumo() {
    return cloroInsumo;
  }

  public void setCloroInsumo(BigDecimal cloroInsumo) {
    this.cloroInsumo = cloroInsumo;
  }

  public BigDecimal getFabulosoProducto() {
    return fabulosoProducto;
  }

  public void setFabulosoProducto(BigDecimal fabulosoProducto) {
    this.fabulosoProducto = fabulosoProducto;
  }

  public BigDecimal getFabulosoAgua() {
    return fabulosoAgua;
  }

  public void setFabulosoAgua(BigDecimal fabulosoAgua) {
    this.fabulosoAgua = fabulosoAgua;
  }

  public BigDecimal getFabulosoInsumo() {
    return fabulosoInsumo;
  }

  public void setFabulosoInsumo(BigDecimal fabulosoInsumo) {
    this.fabulosoInsumo = fabulosoInsumo;
  }
}
