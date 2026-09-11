package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
    name = "caja_config",
    uniqueConstraints = @UniqueConstraint(name = "uk_caja_config_tenant", columnNames = "tenant_id"))
public class CajaConfig extends TenantEntity {

  /** Asignado en servicio (Oracle local no siempre tiene IDENTITY en esta tabla). */
  @Id
  private Long id;

  private LocalDate fechaInicio;
  private LocalDate fechaFin;

  @Column(precision = 14, scale = 4)
  private BigDecimal fondoInicial = BigDecimal.ZERO;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public LocalDate getFechaInicio() {
    return fechaInicio;
  }

  public void setFechaInicio(LocalDate fechaInicio) {
    this.fechaInicio = fechaInicio;
  }

  public LocalDate getFechaFin() {
    return fechaFin;
  }

  public void setFechaFin(LocalDate fechaFin) {
    this.fechaFin = fechaFin;
  }

  public BigDecimal getFondoInicial() {
    return fondoInicial;
  }

  public void setFondoInicial(BigDecimal fondoInicial) {
    this.fondoInicial = fondoInicial;
  }
}
