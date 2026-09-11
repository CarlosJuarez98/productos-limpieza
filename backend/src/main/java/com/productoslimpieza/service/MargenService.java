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
    boolean dirty = false;
    if (c.getMargenMayoreo5() == null) {
      c.setMargenMayoreo5(new BigDecimal("0.4000"));
      dirty = true;
    }
    if (c.getMargenMayoreo10() == null) {
      c.setMargenMayoreo10(new BigDecimal("0.3000"));
      dirty = true;
    }
    return dirty ? repo.save(c) : c;
  }

  @Transactional(readOnly = true)
  public MargenConfigDto dto() {
    return toDto(getConfig());
  }

  @Transactional
  public MargenConfigDto actualizar(MargenConfigRequest req) {
    validar(req.porcentajeMin(), "mínimo");
    validar(req.porcentajeMax(), "máximo");
    validar(req.porcentajeMayoreo5(), "mayoreo ≥5");
    validar(req.porcentajeMayoreo10(), "mayoreo ≥10");
    if (req.porcentajeMin().compareTo(req.porcentajeMax()) > 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El mínimo no puede ser mayor al máximo");
    }
    if (req.porcentajeMayoreo10().compareTo(req.porcentajeMayoreo5()) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El margen ≥10 L no puede ser mayor al de ≥5 L");
    }
    MargenConfig c = getConfig();
    c.setMargenMin(aDecimal(req.porcentajeMin()));
    c.setMargenMax(aDecimal(req.porcentajeMax()));
    c.setMargenMayoreo5(aDecimal(req.porcentajeMayoreo5()));
    c.setMargenMayoreo10(aDecimal(req.porcentajeMayoreo10()));
    c = repo.save(c);
    // No sobrescribe precios actuales: solo guarda %; aplicar es explícito.
    return toDto(c);
  }

  /** Recalcula solo ≥5 L / ≥10 L desde % mayoreo y compra. No toca menudeo ni histórico. */
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
    return repo.save(c);
  }

  private MargenConfigDto toDto(MargenConfig c) {
    BigDecimal min = nz(c.getMargenMin());
    BigDecimal max = nz(c.getMargenMax());
    BigDecimal m5 = nz(c.getMargenMayoreo5());
    BigDecimal m10 = nz(c.getMargenMayoreo10());
    return new MargenConfigDto(
        min,
        max,
        m5,
        m10,
        min.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        max.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        m5.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP),
        m10.multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP)
    );
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
