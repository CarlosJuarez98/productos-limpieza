package com.productoslimpieza.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Marca que el archivo/purge anual de un año civil ya corrió (evita doble ejecución). */
@Entity
@Table(name = "archivo_anual_log")
public class ArchivoAnualLog {

  @Id
  @Column(nullable = false)
  private int anio;

  @Column(name = "ejecutado_en", nullable = false)
  private Instant ejecutadoEn;

  @Column(name = "filas_borradas", nullable = false)
  private long filasBorradas;

  @Column(name = "ruta_archivo", length = 500)
  private String rutaArchivo;

  @Column(length = 40)
  private String modo;

  public int getAnio() {
    return anio;
  }

  public void setAnio(int anio) {
    this.anio = anio;
  }

  public Instant getEjecutadoEn() {
    return ejecutadoEn;
  }

  public void setEjecutadoEn(Instant ejecutadoEn) {
    this.ejecutadoEn = ejecutadoEn;
  }

  public long getFilasBorradas() {
    return filasBorradas;
  }

  public void setFilasBorradas(long filasBorradas) {
    this.filasBorradas = filasBorradas;
  }

  public String getRutaArchivo() {
    return rutaArchivo;
  }

  public void setRutaArchivo(String rutaArchivo) {
    this.rutaArchivo = rutaArchivo;
  }

  public String getModo() {
    return modo;
  }

  public void setModo(String modo) {
    this.modo = modo;
  }
}
