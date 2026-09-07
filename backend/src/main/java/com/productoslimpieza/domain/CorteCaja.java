package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

/** Fecha de corte de caja (naranja en Excel Ventas). */
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
}
