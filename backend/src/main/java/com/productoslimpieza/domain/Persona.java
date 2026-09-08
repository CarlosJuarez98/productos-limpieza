package com.productoslimpieza.domain;

import jakarta.persistence.*;

@Entity
@Table(
    name = "personas",
    uniqueConstraints = @UniqueConstraint(name = "uk_personas_nombre", columnNames = "nombre")
)
public class Persona {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 120)
  private String nombre;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getNombre() { return nombre; }
  public void setNombre(String nombre) { this.nombre = nombre; }
}
