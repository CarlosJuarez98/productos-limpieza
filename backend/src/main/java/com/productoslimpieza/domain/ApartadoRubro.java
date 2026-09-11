package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;

@Entity
@Table(
    name = "apartado_rubros",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_apartado_rubro_tenant_codigo",
        columnNames = {"tenant_id", "codigo"}))
public class ApartadoRubro extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Clave estable (PRODUCTOS, CASA, … o RUBRO_xxx). No cambia al renombrar. */
  @Column(nullable = false, length = 40)
  private String codigo;

  @Column(nullable = false, length = 80)
  private String nombre;

  @Column(nullable = false)
  private boolean activo = true;

  @Column(nullable = false)
  private int orden = 0;

  /** Si true, ingresos cuentan para liquidar el corte / “Apartar de caja”. */
  @Column(name = "liquida_corte", nullable = false)
  private boolean liquidaCorte = true;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getCodigo() {
    return codigo;
  }

  public void setCodigo(String codigo) {
    this.codigo = codigo;
  }

  public String getNombre() {
    return nombre;
  }

  public void setNombre(String nombre) {
    this.nombre = nombre;
  }

  public boolean isActivo() {
    return activo;
  }

  public void setActivo(boolean activo) {
    this.activo = activo;
  }

  public int getOrden() {
    return orden;
  }

  public void setOrden(int orden) {
    this.orden = orden;
  }

  public boolean isLiquidaCorte() {
    return liquidaCorte;
  }

  public void setLiquidaCorte(boolean liquidaCorte) {
    this.liquidaCorte = liquidaCorte;
  }
}
