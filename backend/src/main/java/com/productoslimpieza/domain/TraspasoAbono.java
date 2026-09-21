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

  /** Ingreso en caja ligado a este pago (solo si fue en efectivo). */
  @Column(name = "movimiento_caja_id")
  private Long movimientoCajaId;

  /** Si true, el cobro va al banco (como ventas con tarjeta); no crea ingreso de efectivo. */
  @Column(name = "pago_tarjeta", nullable = false)
  private boolean pagoTarjeta = false;

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
  public Long getMovimientoCajaId() { return movimientoCajaId; }
  public void setMovimientoCajaId(Long movimientoCajaId) { this.movimientoCajaId = movimientoCajaId; }
  public boolean isPagoTarjeta() { return pagoTarjeta; }
  public void setPagoTarjeta(boolean pagoTarjeta) { this.pagoTarjeta = pagoTarjeta; }
}
