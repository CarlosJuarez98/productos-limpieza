package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "margen_config")
public class MargenConfig {

  @Id
  private Long id = 1L;

  /** Ej. 0.465 = 46.5% sobre compra (piso menudeo) */
  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal margenMin = new BigDecimal("0.4650");

  /** Margen menudeo / precio de lista */
  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal margenMax = new BigDecimal("0.6300");

  /** Margen mayoreo desde 5 litros/piezas */
  @Column(precision = 10, scale = 4)
  private BigDecimal margenMayoreo5 = new BigDecimal("0.4000");

  /** Margen mayoreo desde 10 litros/piezas */
  @Column(precision = 10, scale = 4)
  private BigDecimal margenMayoreo10 = new BigDecimal("0.3000");

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public BigDecimal getMargenMin() { return margenMin; }
  public void setMargenMin(BigDecimal margenMin) { this.margenMin = margenMin; }
  public BigDecimal getMargenMax() { return margenMax; }
  public void setMargenMax(BigDecimal margenMax) { this.margenMax = margenMax; }
  public BigDecimal getMargenMayoreo5() { return margenMayoreo5; }
  public void setMargenMayoreo5(BigDecimal margenMayoreo5) { this.margenMayoreo5 = margenMayoreo5; }
  public BigDecimal getMargenMayoreo10() { return margenMayoreo10; }
  public void setMargenMayoreo10(BigDecimal margenMayoreo10) { this.margenMayoreo10 = margenMayoreo10; }
}
