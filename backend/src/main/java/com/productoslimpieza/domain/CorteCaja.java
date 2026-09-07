package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Fecha de corte de caja (tabla cortes_caja en BD). */
@Entity
@Table(
    name = "cortes_caja",
    uniqueConstraints = @UniqueConstraint(name = "uk_corte_fecha", columnNames = "fecha"))
public class CorteCaja {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  /** Fondo con el que arrancó el periodo que se cerró en este corte. */
  @Column(precision = 14, scale = 4)
  private BigDecimal fondoPeriodo;

  @Column(precision = 14, scale = 4)
  private BigDecimal totalCaja;

  @Column(precision = 14, scale = 4)
  private BigDecimal totalNegocio;

  /** Efectivo contado al cerrar (opcional). */
  @Column(precision = 14, scale = 4)
  private BigDecimal totalCalculadora;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public LocalDate getFecha() {
    return fecha;
  }

  public void setFecha(LocalDate fecha) {
    this.fecha = fecha;
  }

  public BigDecimal getFondoPeriodo() {
    return fondoPeriodo;
  }

  public void setFondoPeriodo(BigDecimal fondoPeriodo) {
    this.fondoPeriodo = fondoPeriodo;
  }

  public BigDecimal getTotalCaja() {
    return totalCaja;
  }

  public void setTotalCaja(BigDecimal totalCaja) {
    this.totalCaja = totalCaja;
  }

  public BigDecimal getTotalNegocio() {
    return totalNegocio;
  }

  public void setTotalNegocio(BigDecimal totalNegocio) {
    this.totalNegocio = totalNegocio;
  }

  public BigDecimal getTotalCalculadora() {
    return totalCalculadora;
  }

  public void setTotalCalculadora(BigDecimal totalCalculadora) {
    this.totalCalculadora = totalCalculadora;
  }
}
