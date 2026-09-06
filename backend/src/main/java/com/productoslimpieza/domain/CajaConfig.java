package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "caja_config")
public class CajaConfig {

  @Id
  private Long id = 1L;

  private LocalDate fechaInicio;
  private LocalDate fechaFin;

  @Column(precision = 14, scale = 4)
  private BigDecimal fondoInicial = BigDecimal.ZERO;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFechaInicio() { return fechaInicio; }
  public void setFechaInicio(LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }
  public LocalDate getFechaFin() { return fechaFin; }
  public void setFechaFin(LocalDate fechaFin) { this.fechaFin = fechaFin; }
  public BigDecimal getFondoInicial() { return fondoInicial; }
  public void setFondoInicial(BigDecimal fondoInicial) { this.fondoInicial = fondoInicial; }
}
