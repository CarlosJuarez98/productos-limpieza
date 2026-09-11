package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "margen_config",
    uniqueConstraints = @UniqueConstraint(name = "uk_margen_config_tenant", columnNames = "tenant_id"))
public class MargenConfig extends TenantEntity {

  @Id
  private Long id;

  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal margenMin = new BigDecimal("0.4650");

  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal margenMax = new BigDecimal("0.6300");

  @Column(precision = 10, scale = 4)
  private BigDecimal margenMayoreo5 = new BigDecimal("0.4000");

  @Column(precision = 10, scale = 4)
  private BigDecimal margenMayoreo10 = new BigDecimal("0.3000");

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public BigDecimal getMargenMin() {
    return margenMin;
  }

  public void setMargenMin(BigDecimal margenMin) {
    this.margenMin = margenMin;
  }

  public BigDecimal getMargenMax() {
    return margenMax;
  }

  public void setMargenMax(BigDecimal margenMax) {
    this.margenMax = margenMax;
  }

  public BigDecimal getMargenMayoreo5() {
    return margenMayoreo5;
  }

  public void setMargenMayoreo5(BigDecimal margenMayoreo5) {
    this.margenMayoreo5 = margenMayoreo5;
  }

  public BigDecimal getMargenMayoreo10() {
    return margenMayoreo10;
  }

  public void setMargenMayoreo10(BigDecimal margenMayoreo10) {
    this.margenMayoreo10 = margenMayoreo10;
  }
}
