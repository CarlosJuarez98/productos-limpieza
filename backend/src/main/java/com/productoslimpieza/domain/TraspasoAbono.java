package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "traspaso_abonos")
public class TraspasoAbono {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal monto;

  @Column(length = 120)
  private String persona;

  @Column(length = 255)
  private String nota;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public BigDecimal getMonto() { return monto; }
  public void setMonto(BigDecimal monto) { this.monto = monto; }
  public String getPersona() { return persona; }
  public void setPersona(String persona) { this.persona = persona; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
}
