package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pedidos")
public class Pedido extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private EstadoPedido estado = EstadoPedido.ABIERTO;

  @Column(name = "periodo_desde")
  private LocalDate periodoDesde;

  @Column(name = "periodo_hasta")
  private LocalDate periodoHasta;

  @Column(name = "dias_cobertura")
  private Integer diasCobertura;

  @Column(name = "porcentaje_extra", precision = 8, scale = 2)
  private BigDecimal porcentajeExtra;

  @Column(length = 255)
  private String nota;

  @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("id ASC")
  private List<PedidoItem> items = new ArrayList<>();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public EstadoPedido getEstado() { return estado; }
  public void setEstado(EstadoPedido estado) { this.estado = estado; }
  public LocalDate getPeriodoDesde() { return periodoDesde; }
  public void setPeriodoDesde(LocalDate periodoDesde) { this.periodoDesde = periodoDesde; }
  public LocalDate getPeriodoHasta() { return periodoHasta; }
  public void setPeriodoHasta(LocalDate periodoHasta) { this.periodoHasta = periodoHasta; }
  public Integer getDiasCobertura() { return diasCobertura; }
  public void setDiasCobertura(Integer diasCobertura) { this.diasCobertura = diasCobertura; }
  public BigDecimal getPorcentajeExtra() { return porcentajeExtra; }
  public void setPorcentajeExtra(BigDecimal porcentajeExtra) { this.porcentajeExtra = porcentajeExtra; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
  public List<PedidoItem> getItems() { return items; }
  public void setItems(List<PedidoItem> items) { this.items = items; }

  public void addItem(PedidoItem item) {
    items.add(item);
    item.setPedido(this);
  }
}
