package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "ventas")
public class Venta extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto producto;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private TipoVenta tipoVenta;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal cantidad;

  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal total = BigDecimal.ZERO;

  /** Si es true, el cobro entra al banco (no al efectivo de caja). */
  @Column(nullable = false)
  private boolean pagoTarjeta = false;

  /**
   * Folio de ticket del día (nota de venta). Varias líneas del mismo lote comparten folio.
   * Reinicia en 1 cada fecha de venta.
   */
  @Column(name = "folio")
  private Long folio;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public Producto getProducto() { return producto; }
  public void setProducto(Producto producto) { this.producto = producto; }
  public TipoVenta getTipoVenta() { return tipoVenta; }
  public void setTipoVenta(TipoVenta tipoVenta) { this.tipoVenta = tipoVenta; }
  public BigDecimal getCantidad() { return cantidad; }
  public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
  public boolean isPagoTarjeta() { return pagoTarjeta; }
  public void setPagoTarjeta(boolean pagoTarjeta) { this.pagoTarjeta = pagoTarjeta; }
  public Long getFolio() { return folio; }
  public void setFolio(Long folio) { this.folio = folio; }
}
