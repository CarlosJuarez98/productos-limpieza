package com.productoslimpieza.service;

import com.productoslimpieza.domain.RecetaConfig;
import com.productoslimpieza.repo.RecetaConfigRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.RecetaConfigDto;
import com.productoslimpieza.web.dto.RecetaConfigRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecetaConfigService {

  private final RecetaConfigRepository repo;

  public RecetaConfigService(RecetaConfigRepository repo) {
    this.repo = repo;
  }

  @Transactional
  public RecetaConfig getConfig() {
    return repo.findByTenantId(TenantContext.require()).orElseGet(this::crearDefault);
  }

  /** Lectura sin crear fila (para contextos read-only). */
  @Transactional(readOnly = true)
  public RecetaConfig leerODefault() {
    return repo.findByTenantId(TenantContext.require()).orElseGet(RecetaConfig::new);
  }

  @Transactional
  public RecetaConfigDto dto() {
    return toDto(getConfig());
  }

  @Transactional
  public RecetaConfigDto actualizar(RecetaConfigRequest req) {
    validarParte(req.cloroProducto(), req.cloroAgua(), req.cloroInsumo(), "Cloro");
    validarParte(req.fabulosoProducto(), req.fabulosoAgua(), req.fabulosoInsumo(), "Fabuloso");
    RecetaConfig c = getConfig();
    c.setCloroProducto(scale(req.cloroProducto()));
    c.setCloroAgua(scale(req.cloroAgua()));
    c.setCloroInsumo(scale(req.cloroInsumo()));
    c.setFabulosoProducto(scale(req.fabulosoProducto()));
    c.setFabulosoAgua(scale(req.fabulosoAgua()));
    c.setFabulosoInsumo(scale(req.fabulosoInsumo()));
    return toDto(repo.save(c));
  }

  /** Litros de insumo por litro de producto terminado. */
  @Transactional(readOnly = true)
  public BigDecimal ratioInsumoPorResultado(String nombreResultado) {
    RecetaConfig c = leerODefault();
    if (esCloro(nombreResultado)) {
      return ratio(c.getCloroInsumo(), c.getCloroProducto());
    }
    if (esFabuloso(nombreResultado)) {
      return ratio(c.getFabulosoInsumo(), c.getFabulosoProducto());
    }
    return BigDecimal.ZERO;
  }

  @Transactional(readOnly = true)
  public BigDecimal ratioAguaPorResultado(String nombreResultado) {
    RecetaConfig c = leerODefault();
    if (esCloro(nombreResultado)) {
      return ratio(c.getCloroAgua(), c.getCloroProducto());
    }
    if (esFabuloso(nombreResultado)) {
      return ratio(c.getFabulosoAgua(), c.getFabulosoProducto());
    }
    return BigDecimal.ZERO;
  }

  private static BigDecimal ratio(BigDecimal parte, BigDecimal total) {
    BigDecimal t = nz(total);
    if (t.compareTo(BigDecimal.ZERO) <= 0) {
      return BigDecimal.ZERO;
    }
    return nz(parte).divide(t, 8, RoundingMode.HALF_UP);
  }

  private RecetaConfig crearDefault() {
    RecetaConfig c = new RecetaConfig();
    c.setId(repo.nextId());
    c.setTenantId(TenantContext.require());
    return repo.save(c);
  }

  private void validarParte(BigDecimal producto, BigDecimal agua, BigDecimal insumo, String nombre) {
    BigDecimal suma = nz(agua).add(nz(insumo));
    if (suma.subtract(nz(producto)).abs().compareTo(new BigDecimal("0.0001")) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          nombre + ": agua + insumo debe ser igual a la cantidad de producto ("
              + producto
              + " = "
              + agua
              + " + "
              + insumo
              + ")");
    }
  }

  private static boolean esCloro(String nombre) {
    return "cloro".equals(normalizar(nombre));
  }

  private static boolean esFabuloso(String nombre) {
    String n = normalizar(nombre);
    return "fabuloso".equals(n) || n.startsWith("fabuloso ");
  }

  private static String normalizar(String s) {
    return s == null
        ? ""
        : s.trim()
            .toLowerCase(Locale.ROOT)
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u");
  }

  private RecetaConfigDto toDto(RecetaConfig c) {
    return new RecetaConfigDto(
        scale(c.getCloroProducto()),
        scale(c.getCloroAgua()),
        scale(c.getCloroInsumo()),
        scale(c.getFabulosoProducto()),
        scale(c.getFabulosoAgua()),
        scale(c.getFabulosoInsumo()));
  }

  private static BigDecimal scale(BigDecimal v) {
    return nz(v).setScale(4, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
