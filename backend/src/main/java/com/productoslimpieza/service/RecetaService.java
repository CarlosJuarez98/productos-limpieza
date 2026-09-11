package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Receta;
import com.productoslimpieza.domain.RecetaConfig;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.RecetaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.RecetaDto;
import com.productoslimpieza.web.dto.RecetaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecetaService {

  /** Semilla histórica: resultado → insumo (nombres). */
  private static final Map<String, String> SEMILLA_INSUMOS =
      Map.ofEntries(
          Map.entry("cloro", "Hipoclorito"),
          Map.entry("fabuloso bosques", "Base Fabuloso Bosques"),
          Map.entry("fabuloso bosque de limon", "Base Fabuloso Limon"),
          Map.entry("fabuloso brisas", "Base Fabuloso Brisas"),
          Map.entry("fabuloso flores", "Base Fabuloso Flores"),
          Map.entry("fabuloso lavanda", "Base Fabuloso Lavanda"),
          Map.entry("fabuloso limon", "Base Fabuloso Limon"),
          Map.entry("fabuloso mandarina", "Base Fabuloso Mandarina"),
          Map.entry("fabuloso manzana canela", "Base Fabuloso Manzana Canela"),
          Map.entry("fabuloso frutas", "Base Fabuloso Frutas"),
          Map.entry("fabuloso chicle", "Base Fabuloso Chicle"));

  private final RecetaRepository repo;
  private final ProductoRepository productoRepo;
  private final RecetaConfigService configService;

  public RecetaService(
      RecetaRepository repo, ProductoRepository productoRepo, RecetaConfigService configService) {
    this.repo = repo;
    this.productoRepo = productoRepo;
    this.configService = configService;
  }

  @Transactional
  public List<RecetaDto> listar() {
    sembrarSiVacio();
    return repo.findAllByOrderByIdAsc().stream()
        .sorted(Comparator.comparing(r -> r.getProductoResultado().getNombre(), String.CASE_INSENSITIVE_ORDER))
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public Optional<Receta> findByProductoResultadoId(Long productoResultadoId) {
    return repo.findByProductoResultadoId(productoResultadoId);
  }

  /** Litros de insumo por litro de producto terminado. */
  @Transactional(readOnly = true)
  public BigDecimal ratioInsumo(Long productoResultadoId) {
    return repo.findByProductoResultadoId(productoResultadoId)
        .map(r -> ratio(r.getCantidadInsumo(), r.getCantidadProducto()))
        .orElse(BigDecimal.ZERO);
  }

  @Transactional
  public RecetaDto crear(RecetaRequest req) {
    if (repo.existsByProductoResultadoId(req.productoResultadoId())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Ese producto ya tiene una fórmula. Edítala o elige otro.");
    }
    Receta r = new Receta();
    aplicar(r, req);
    return toDto(repo.save(r));
  }

  @Transactional
  public RecetaDto actualizar(Long id, RecetaRequest req) {
    Receta r =
        repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fórmula no encontrada"));
    Optional<Receta> otra = repo.findByProductoResultadoId(req.productoResultadoId());
    if (otra.isPresent() && !otra.get().getId().equals(id)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Ese producto ya tiene otra fórmula");
    }
    aplicar(r, req);
    return toDto(repo.save(r));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!repo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fórmula no encontrada");
    }
    repo.deleteById(id);
  }

  private void aplicar(Receta r, RecetaRequest req) {
    if (req.productoResultadoId().equals(req.productoInsumoId())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto y el insumo no pueden ser el mismo");
    }
    validarSuma(req.cantidadProducto(), req.cantidadAgua(), req.cantidadInsumo());
    Producto resultado =
        productoRepo
            .findById(req.productoResultadoId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    Producto insumo =
        productoRepo
            .findById(req.productoInsumoId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Insumo no encontrado"));
    if (!resultado.isActivo() || !insumo.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
    r.setProductoResultado(resultado);
    r.setProductoInsumo(insumo);
    r.setCantidadProducto(scale(req.cantidadProducto()));
    r.setCantidadAgua(scale(req.cantidadAgua()));
    r.setCantidadInsumo(scale(req.cantidadInsumo()));
  }

  private void sembrarSiVacio() {
    String tenant = TenantContext.require();
    if (repo.countByTenantId(tenant) > 0) {
      return;
    }
    RecetaConfig cfg = configService.leerODefault();
    List<Producto> productos = productoRepo.findAll();
    for (Producto resultado : productos) {
      if (!resultado.isActivo()) continue;
      String key = normalizar(resultado.getNombre());
      String insumoNombre = SEMILLA_INSUMOS.get(key);
      if (insumoNombre == null && key.startsWith("fabuloso ")) {
        String resto = resultado.getNombre().trim();
        int idx = resto.toLowerCase(Locale.ROOT).indexOf("fabuloso");
        if (idx >= 0) {
          resto = resto.substring(idx + "fabuloso".length()).trim();
          insumoNombre = "Base Fabuloso " + resto;
        }
      }
      if (insumoNombre == null) continue;
      final String buscar = normalizar(insumoNombre);
      Optional<Producto> insumoOpt =
          productos.stream()
              .filter(p -> p.isActivo() && normalizar(p.getNombre()).equals(buscar))
              .findFirst();
      if (insumoOpt.isEmpty()) continue;
      Receta r = new Receta();
      r.setProductoResultado(resultado);
      r.setProductoInsumo(insumoOpt.get());
      if ("cloro".equals(key)) {
        r.setCantidadProducto(scale(cfg.getCloroProducto()));
        r.setCantidadAgua(scale(cfg.getCloroAgua()));
        r.setCantidadInsumo(scale(cfg.getCloroInsumo()));
      } else {
        r.setCantidadProducto(scale(cfg.getFabulosoProducto()));
        r.setCantidadAgua(scale(cfg.getFabulosoAgua()));
        r.setCantidadInsumo(scale(cfg.getFabulosoInsumo()));
      }
      repo.save(r);
    }
  }

  private void validarSuma(BigDecimal producto, BigDecimal agua, BigDecimal insumo) {
    BigDecimal suma = nz(agua).add(nz(insumo));
    if (suma.subtract(nz(producto)).abs().compareTo(new BigDecimal("0.0001")) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Agua + insumo debe ser igual a la cantidad de producto ("
              + producto
              + " = "
              + agua
              + " + "
              + insumo
              + ")");
    }
  }

  private static BigDecimal ratio(BigDecimal parte, BigDecimal total) {
    BigDecimal t = nz(total);
    if (t.compareTo(BigDecimal.ZERO) <= 0) {
      return BigDecimal.ZERO;
    }
    return nz(parte).divide(t, 8, RoundingMode.HALF_UP);
  }

  private RecetaDto toDto(Receta r) {
    Producto res = r.getProductoResultado();
    Producto ins = r.getProductoInsumo();
    return new RecetaDto(
        r.getId(),
        res.getId(),
        res.getNombre(),
        ins.getId(),
        ins.getNombre(),
        scale(r.getCantidadProducto()),
        scale(r.getCantidadAgua()),
        scale(r.getCantidadInsumo()));
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

  private static BigDecimal scale(BigDecimal v) {
    return nz(v).setScale(4, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
