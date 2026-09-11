package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "apartados")
public class Apartado extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private CategoriaApartado categoria;

  /** Monto del movimiento (ingreso o gasto según tipo). */
  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal ingreso;

  @Enumerated(EnumType.STRING)
  @Column(length = 20)
  private TipoMovimientoApartado tipo = TipoMovimientoApartado.INGRESO;

  @Column(length = 200)
  private String motivo;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public CategoriaApartado getCategoria() { return categoria; }
  public void setCategoria(CategoriaApartado categoria) { this.categoria = categoria; }
  public BigDecimal getIngreso() { return ingreso; }
  public void setIngreso(BigDecimal ingreso) { this.ingreso = ingreso; }
  public TipoMovimientoApartado getTipo() { return tipo; }
  public void setTipo(TipoMovimientoApartado tipo) { this.tipo = tipo; }
  public String getMotivo() { return motivo; }
  public void setMotivo(String motivo) { this.motivo = motivo; }
}
