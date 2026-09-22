package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Cotización / pedido a domicilio: pendiente hasta entregar (entonces se crean ventas). */
@Entity
@Table(name = "pedidos_domicilio")
public class PedidoDomicilio extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private EstadoPedidoDomicilio estado = EstadoPedidoDomicilio.PENDIENTE;

  @Column(length = 120)
  private String cliente;

  @Column(length = 30)
  private String telefono;

  @Column(length = 255)
  private String nota;

  @Column(name = "fecha_entrega")
  private LocalDate fechaEntrega;

  /** Ventas creadas al entregar (para poder editar/borrar el domicilio entregado). */
  @ElementCollection
  @CollectionTable(
      name = "pedido_domicilio_ventas",
      joinColumns = @JoinColumn(name = "pedido_id"))
  @Column(name = "venta_id", nullable = false)
  private List<Long> ventaIds = new ArrayList<>();

  @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("id ASC")
  private List<PedidoDomicilioItem> items = new ArrayList<>();

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public LocalDate getFecha() {
    return fecha;
  }

  public void setFecha(LocalDate fecha) {
    this.fecha = fecha;
  }

  public EstadoPedidoDomicilio getEstado() {
    return estado;
  }

  public void setEstado(EstadoPedidoDomicilio estado) {
    this.estado = estado;
  }

  public String getCliente() {
    return cliente;
  }

  public void setCliente(String cliente) {
    this.cliente = cliente;
  }

  public String getTelefono() {
    return telefono;
  }

  public void setTelefono(String telefono) {
    this.telefono = telefono;
  }

  public String getNota() {
    return nota;
  }

  public void setNota(String nota) {
    this.nota = nota;
  }

  public LocalDate getFechaEntrega() {
    return fechaEntrega;
  }

  public void setFechaEntrega(LocalDate fechaEntrega) {
    this.fechaEntrega = fechaEntrega;
  }

  public List<Long> getVentaIds() {
    return ventaIds;
  }

  public void setVentaIds(List<Long> ventaIds) {
    // Siempre mutable: Hibernate hace clear()/addAll() en el merge.
    this.ventaIds = ventaIds != null ? new ArrayList<>(ventaIds) : new ArrayList<>();
  }

  public List<PedidoDomicilioItem> getItems() {
    return items;
  }

  public void setItems(List<PedidoDomicilioItem> items) {
    this.items = items;
  }

  public void addItem(PedidoDomicilioItem item) {
    items.add(item);
    item.setPedido(this);
  }

  public void clearItems() {
    for (PedidoDomicilioItem i : items) {
      i.setPedido(null);
    }
    items.clear();
  }
}
