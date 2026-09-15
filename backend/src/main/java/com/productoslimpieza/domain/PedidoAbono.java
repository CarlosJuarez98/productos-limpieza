package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "pedido_abonos")
public class PedidoAbono extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "pedido_id")
  private Pedido pedido;

  @Column(nullable = false)
  private LocalDate fecha;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal monto;

  @Column(length = 255)
  private String nota;

  /** Gasto en apartado Productos ligado a este pago (se actualiza/borra con el abono). */
  @Column(name = "apartado_id")
  private Long apartadoId;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Pedido getPedido() { return pedido; }
  public void setPedido(Pedido pedido) { this.pedido = pedido; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public BigDecimal getMonto() { return monto; }
  public void setMonto(BigDecimal monto) { this.monto = monto; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
  public Long getApartadoId() { return apartadoId; }
  public void setApartadoId(Long apartadoId) { this.apartadoId = apartadoId; }
}
