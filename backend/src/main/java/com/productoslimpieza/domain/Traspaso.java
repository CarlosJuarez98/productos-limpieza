package com.productoslimpieza.domain;

import com.productoslimpieza.tenant.TenantEntity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "traspasos")
public class Traspaso extends TenantEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDate fecha;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "persona_id")
  private Persona persona;

  /** Legado: texto libre; se migra a persona_id. */
  @Column(name = "persona", length = 120)
  private String personaNombre;

  @Column(length = 255)
  private String nota;

  /** Total del traspaso (suma de líneas). */
  @Column(nullable = false, precision = 14, scale = 4)
  private BigDecimal total = BigDecimal.ZERO;

  @OneToMany(mappedBy = "traspaso", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("id ASC")
  private List<TraspasoLinea> lineas = new ArrayList<>();

  /* --- columnas legado (1 producto); se migran a traspaso_lineas --- */
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "producto_id")
  private Producto productoLegado;

  @Column(name = "cantidad", precision = 14, scale = 4)
  private BigDecimal cantidadLegado;

  @Column(name = "precio_compra", precision = 14, scale = 4)
  private BigDecimal precioCompraLegado;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public LocalDate getFecha() { return fecha; }
  public void setFecha(LocalDate fecha) { this.fecha = fecha; }
  public Persona getPersona() { return persona; }
  public void setPersona(Persona persona) { this.persona = persona; }
  public String getPersonaNombre() { return personaNombre; }
  public void setPersonaNombre(String personaNombre) { this.personaNombre = personaNombre; }
  public String getNota() { return nota; }
  public void setNota(String nota) { this.nota = nota; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
  public List<TraspasoLinea> getLineas() { return lineas; }
  public void setLineas(List<TraspasoLinea> lineas) { this.lineas = lineas; }

  public void addLinea(TraspasoLinea linea) {
    lineas.add(linea);
    linea.setTraspaso(this);
  }

  public Producto getProductoLegado() { return productoLegado; }
  public void setProductoLegado(Producto productoLegado) { this.productoLegado = productoLegado; }
  public BigDecimal getCantidadLegado() { return cantidadLegado; }
  public void setCantidadLegado(BigDecimal cantidadLegado) { this.cantidadLegado = cantidadLegado; }
  public BigDecimal getPrecioCompraLegado() { return precioCompraLegado; }
  public void setPrecioCompraLegado(BigDecimal precioCompraLegado) {
    this.precioCompraLegado = precioCompraLegado;
  }
}
