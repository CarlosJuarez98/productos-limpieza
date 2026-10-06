package com.productoslimpieza.service;

import com.productoslimpieza.domain.MargenConfig;
import com.productoslimpieza.repo.MargenConfigRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.MargenConfigDto;
import com.productoslimpieza.web.dto.MargenConfigRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MargenService {

  private static final BigDecimal HUNDRED = new BigDecimal("100");

  private final MargenConfigRepository repo;
  private final InventarioService inventarioService;

  public MargenService(MargenConfigRepository repo, @Lazy InventarioService inventarioService) {
    this.repo = repo;
    this.inventarioService = inventarioService;
  }

  @Transactional
  public MargenConfig getConfig() {
    MargenConfig c = repo.findByTenantId(TenantContext.require()).orElseGet(this::crearDefault);
    // % viejos 40/30 eran margen sobre compra; al pasar a descuento s/ menudeo se limpian
    // para no recalcular con el significado incorrecto.
    boolean dirty = false;
    if (esFrac(c.getMargenMayoreo5(), "0.4000") && esFrac(c.getMargenMayoreo10(), "0.3000")) {
      c.setMargenMayoreo5(null);
      c.setMargenMayoreo10(null);
      dirty = true;
    }
    return dirty ? repo.save(c) : c;
  }

  private static boolean esFrac(BigDecimal v, String esperado) {
    return v != null && v.compareTo(new BigDecimal(esperado)) == 0;
  }

  @Transactional(readOnly = true)
  public MargenConfigDto dto() {
    return toDto(getConfig());
  }

  @Transactional
  public MargenConfigDto actualizar(MargenConfigRequest req) {
    validar(req.porcentajeMin(), "mínimo");
    validar(req.porcentajeMax(), "máximo");
    if (req.porcentajeMin().compareTo(req.porcentajeMax()) > 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El mínimo no puede ser mayor al máximo");
    }
    if (req.porcentajeMayoreo5() != null) {
      validar(req.porcentajeMayoreo5(), "mayoreo ≥5");
      if (req.porcentajeMayoreo5().compareTo(HUNDRED) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El descuento mayoreo ≥5 no puede ser mayor a 100%");
      }
    }
    if (req.porcentajeMayoreo10() != null) {
      validar(req.porcentajeMayoreo10(), "mayoreo ≥10");
      if (req.porcentajeMayoreo10().compareTo(HUNDRED) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El descuento mayoreo ≥10 no puede ser mayor a 100%");
      }
    }
    // ≥10 L debe descontar igual o más que ≥5 L
    if (req.porcentajeMayoreo5() != null
        && req.porcentajeMayoreo10() != null
        && req.porcentajeMayoreo10().compareTo(req.porcentajeMayoreo5()) < 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El descuento ≥10 L no puede ser menor al de ≥5 L");
    }
    MargenConfig c = getConfig();
    c.setMargenMin(aDecimal(req.porcentajeMin()));
    c.setMargenMax(aDecimal(req.porcentajeMax()));
    c.setMargenMayoreo5(req.porcentajeMayoreo5() == null ? null : aDecimal(req.porcentajeMayoreo5()));
    c.setMargenMayoreo10(req.porcentajeMayoreo10() == null ? null : aDecimal(req.porcentajeMayoreo10()));
    c = repo.save(c);
    return toDto(c);
  }

  /** Recalcula ≥5 / ≥10 como descuento sobre menudeo. No toca menudeo ni histórico. */
  @Transactional
  public MargenConfigDto aplicarPrecios() {
    MargenConfig c = getConfig();
    inventarioService.aplicarPreciosDesdeMargenes(c);
    return toDto(c);
  }

  private void validar(BigDecimal pct, String nombre) {
    if (pct.compareTo(BigDecimal.ZERO) < 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El porcentaje " + nombre + " no puede ser negativo");
    }
  }

  private BigDecimal aDecimal(BigDecimal porcentaje) {
    return porcentaje.divide(HUNDRED, 4, RoundingMode.HALF_UP);
  }

  private MargenConfig crearDefault() {
    MargenConfig c = new MargenConfig();
    c.setId(repo.nextId());
    c.setTenantId(TenantContext.require());
    c.setMargenMayoreo5(null);
    c.setMargenMayoreo10(null);
    return repo.save(c);
  }

  private MargenConfigDto toDto(MargenConfig c) {
    BigDecimal min = nz(c.getMargenMin());
    BigDecimal max = nz(c.getMargenMax());
    BigDecimal m5 = c.getMargenMayoreo5();
    BigDecimal m10 = c.getMargenMayoreo10();
    return new MargenConfigDto(
        min,
        max,
        m5,
        m10,
        min.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        max.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        m5 == null ? null : m5.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        m10 == null ? null : m10.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP));
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
