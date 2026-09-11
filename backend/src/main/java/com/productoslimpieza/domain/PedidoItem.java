package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "pedido_items")
public class PedidoItem extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "pedido_id")
  private Pedido pedido;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto producto;

  @Column(name = "cantidad_pedida", nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidadPedida;

  /** Lo que sí llegó del surtido (se captura en Surtir o vía entradas aplicadas). */
  @Column(name = "cantidad_recibida", nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidadRecibida = BigDecimal.ZERO;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Pedido getPedido() { return pedido; }
  public void setPedido(Pedido pedido) { this.pedido = pedido; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public BigDecimal getCantidadPedida() { return cantidadPedida; }
  public void setCantidadPedida(BigDecimal cantidadPedida) { this.cantidadPedida = cantidadPedida; }
  public BigDecimal getCantidadRecibida() { return cantidadRecibida; }
  public void setCantidadRecibida(BigDecimal cantidadRecibida) {
    this.cantidadRecibida = cantidadRecibida != null ? cantidadRecibida : BigDecimal.ZERO;
  }
}
