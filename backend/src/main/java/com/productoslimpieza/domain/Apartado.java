package com.productoslimpieza.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "apartados")
public class Apartado {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private CategoriaApartado categoria;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal ingreso;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public CategoriaApartado getCategoria() { return categoria; }
  public void setCategoria(CategoriaApartado categoria) { this.categoria = categoria; }
  public BigDecimal getIngreso() { return ingreso; }
  public void setIngreso(BigDecimal ingreso) { this.ingreso = ingreso; }
}
