package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "traspaso_abonos")
public class TraspasoAbono extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal monto;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "persona_id")
  private Persona persona;

  /** Legado: texto libre; se migra a persona_id. */
  @Column(name = "persona", length = 120)
  private String personaNombre;

  @Column(length = 255)
  private String nota;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public BigDecimal getMonto() { return monto; }
  public void setMonto(BigDecimal monto) { this.monto = monto; }
  public Persona getPersona() { return persona; }
  public void setPersona(Persona persona) { this.persona = persona; }
  public String getPersonaNombre() { return personaNombre; }
  public void setPersonaNombre(String personaNombre) { this.personaNombre = personaNombre; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
}
