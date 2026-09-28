package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "productos", uniqueConstraints = @UniqueConstraint(name = "uk_productos_tenant_nombre", columnNames = {"tenant_id", "nombre"}))
public class Producto extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 200)
  private String nombre;

  @Column(precision = 14, scale = 4)
  private BigDecimal precioCompra = BigDecimal.ZERO;

  @Column(precision = 14, scale = 4)
  private BigDecimal cantidadInicial = BigDecimal.ZERO;

  /** Precio unitario mayoreo desde 5 L / piezas */
  @Column(precision = 14, scale = 4)
  private BigDecimal precioMayoreo5;

  /** Precio unitario mayoreo desde 10 L / piezas */
  @Column(precision = 14, scale = 4)
  private BigDecimal precioMayoreo10;

  /** Cómo se vende al menudeo: LITROS o PIEZA. */
  @Enumerated(EnumType.STRING)
  @Column(name = "vende_por", length = 20)
  private UnidadVenta vendePor = UnidadVenta.LITROS;

  /** Limpieza o jarcería (proveedor), no depende de litros/pieza. */
  @Enumerated(EnumType.STRING)
  @Column(name = "departamento", length = 20)
  private DepartamentoProducto departamento = DepartamentoProducto.LIMPIEZA;

  @Column(nullable = false)
  private boolean activo = true;

  /** Si true, este producto es el bastón de madera (insumo de armar). */
  @Column(name = "es_baston", nullable = false)
  private boolean esBaston = false;

  /** Si true, al recibir sin bastón queda pendiente de armar. */
  @Column(name = "usa_baston", nullable = false)
  private boolean usaBaston = false;

  /** Bastones necesarios por unidad al armar (normalmente 1). */
  @Column(name = "bastones_por_unidad", precision = 14, scale = 4)
  private BigDecimal bastonesPorUnidad = BigDecimal.ONE;

  /** Producto bastón a descontar al armar (si null, se usa el marcado esBaston). */
  @Column(name = "baston_producto_id")
  private Long bastonProductoId;

  /** Unidades en stock que aún no tienen bastón. */
  @Column(name = "pendiente_armar", precision = 14, scale = 4, nullable = false)
  private BigDecimal pendienteArmar = BigDecimal.ZERO;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getNombre() { return nombre; }
  public void setNombre(String nombre) { this.nombre = nombre; }
  public BigDecimal getPrecioCompra() { return precioCompra; }
  public void setPrecioCompra(BigDecimal precioCompra) { this.precioCompra = precioCompra; }
  public BigDecimal getCantidadInicial() { return cantidadInicial; }
  public void setCantidadInicial(BigDecimal cantidadInicial) { this.cantidadInicial = cantidadInicial; }
  public BigDecimal getPrecioMayoreo5() { return precioMayoreo5; }
  public void setPrecioMayoreo5(BigDecimal precioMayoreo5) { this.precioMayoreo5 = precioMayoreo5; }
  public BigDecimal getPrecioMayoreo10() { return precioMayoreo10; }
  public void setPrecioMayoreo10(BigDecimal precioMayoreo10) { this.precioMayoreo10 = precioMayoreo10; }
  public UnidadVenta getVendePor() { return vendePor; }
  public void setVendePor(UnidadVenta vendePor) { this.vendePor = vendePor; }
  public DepartamentoProducto getDepartamento() { return departamento; }
  public void setDepartamento(DepartamentoProducto departamento) { this.departamento = departamento; }
  public boolean isActivo() { return activo; }
  public void setActivo(boolean activo) { this.activo = activo; }
  public boolean isEsBaston() { return esBaston; }
  public void setEsBaston(boolean esBaston) { this.esBaston = esBaston; }
  public boolean isUsaBaston() { return usaBaston; }
  public void setUsaBaston(boolean usaBaston) { this.usaBaston = usaBaston; }
  public BigDecimal getBastonesPorUnidad() { return bastonesPorUnidad; }
  public void setBastonesPorUnidad(BigDecimal bastonesPorUnidad) { this.bastonesPorUnidad = bastonesPorUnidad; }
  public Long getBastonProductoId() { return bastonProductoId; }
  public void setBastonProductoId(Long bastonProductoId) { this.bastonProductoId = bastonProductoId; }
  public BigDecimal getPendienteArmar() { return pendienteArmar; }
  public void setPendienteArmar(BigDecimal pendienteArmar) { this.pendienteArmar = pendienteArmar; }
}
