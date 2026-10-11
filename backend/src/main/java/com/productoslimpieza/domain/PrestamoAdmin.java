package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "prestamos_admin")
public class PrestamoAdmin extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal monto;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private TipoPrestamoAdmin tipo;

  @Column(length = 255)
  private String nota;

  @Column(name = "pedido_id")
  private Long pedidoId;

  /** Si nació de un pago a proveedor con dinero propio. */
  @Column(name = "pedido_abono_id")
  private Long pedidoAbonoId;

  /** En DEVOLUCION: apartado de donde salió el dinero (PRODUCTOS, SALARIOS, …). */
  @Column(name = "categoria", length = 40)
  private String categoria;

  /** Gasto en apartados ligado a la devolución. */
  @Column(name = "apartado_id")
  private Long apartadoId;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public BigDecimal getMonto() { return monto; }
  public void setMonto(BigDecimal monto) { this.monto = monto; }
  public TipoPrestamoAdmin getTipo() { return tipo; }
  public void setTipo(TipoPrestamoAdmin tipo) { this.tipo = tipo; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
  public Long getPedidoId() { return pedidoId; }
  public void setPedidoId(Long pedidoId) { this.pedidoId = pedidoId; }
  public Long getPedidoAbonoId() { return pedidoAbonoId; }
  public void setPedidoAbonoId(Long pedidoAbonoId) { this.pedidoAbonoId = pedidoAbonoId; }
  public String getCategoria() { return categoria; }
  public void setCategoria(String categoria) { this.categoria = categoria; }
  public Long getApartadoId() { return apartadoId; }
  public void setApartadoId(Long apartadoId) { this.apartadoId = apartadoId; }
}
