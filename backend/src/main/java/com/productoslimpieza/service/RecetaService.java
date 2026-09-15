package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Receta;
import com.productoslimpieza.domain.RecetaConfig;
import com.productoslimpieza.domain.RecetaInsumo;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.RecetaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.RecetaDto;
import com.productoslimpieza.web.dto.RecetaInsumoDto;
import com.productoslimpieza.web.dto.RecetaInsumoRequest;
import com.productoslimpieza.web.dto.RecetaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
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

  /** Semilla histórica: resultado → insumo (nombres). Mix especial: bosque de limón. */
  private static final Map<String, String> SEMILLA_INSUMOS =
      Map.ofEntries(
          Map.entry("cloro", "Hipoclorito"),
          Map.entry("fabuloso bosques", "Base Fabuloso Bosques"),
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
    migrarInsumosLegacy();
    return repo.findAllByOrderByIdAsc().stream()
        .sorted(Comparator.comparing(r -> r.getProductoResultado().getNombre(), String.CASE_INSENSITIVE_ORDER))
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public Optional<Receta> findByProductoResultadoId(Long productoResultadoId) {
    return repo.findByProductoResultadoId(productoResultadoId);
  }

  /** Litros totales de concentrado por litro de producto terminado. */
  @Transactional(readOnly = true)
  public BigDecimal ratioInsumo(Long productoResultadoId) {
    return repo.findByProductoResultadoId(productoResultadoId)
        .map(r -> ratio(sumaInsumos(r), r.getCantidadProducto()))
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
    List<RecetaInsumoRequest> lineas = normalizarInsumosRequest(req);
    Producto resultado =
        productoRepo
            .findById(req.productoResultadoId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    if (!resultado.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }

    BigDecimal totalInsumo = BigDecimal.ZERO;
    List<RecetaInsumo> nuevas = new ArrayList<>();
    for (RecetaInsumoRequest linea : lineas) {
      if (req.productoResultadoId().equals(linea.productoInsumoId())) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El producto y un insumo no pueden ser el mismo");
      }
      Producto insumo =
          productoRepo
              .findById(linea.productoInsumoId())
              .orElseThrow(
                  () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Insumo no encontrado"));
      if (!insumo.isActivo()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El insumo «" + insumo.getNombre() + "» está dado de baja");
      }
      RecetaInsumo ri = new RecetaInsumo();
      ri.setProducto(insumo);
      ri.setCantidad(scale(linea.cantidad()));
      ri.setTenantId(r.getTenantId());
      nuevas.add(ri);
      totalInsumo = totalInsumo.add(scale(linea.cantidad()));
    }
    validarSuma(req.cantidadProducto(), req.cantidadAgua(), totalInsumo);

    r.setProductoResultado(resultado);
    r.setCantidadProducto(scale(req.cantidadProducto()));
    r.setCantidadAgua(scale(req.cantidadAgua()));
    r.setProductoInsumo(nuevas.get(0).getProducto());
    r.setCantidadInsumo(totalInsumo);
    r.clearInsumos();
    for (RecetaInsumo ri : nuevas) {
      r.addInsumo(ri);
    }
  }

  private List<RecetaInsumoRequest> normalizarInsumosRequest(RecetaRequest req) {
    List<RecetaInsumoRequest> lineas = new ArrayList<>();
    if (req.insumos() != null) {
      for (RecetaInsumoRequest i : req.insumos()) {
        if (i == null || i.productoInsumoId() == null || i.cantidad() == null) continue;
        if (i.cantidad().compareTo(BigDecimal.ZERO) <= 0) continue;
        lineas.add(i);
      }
    }
    if (lineas.isEmpty() && req.productoInsumoId() != null && req.cantidadInsumo() != null) {
      lineas.add(new RecetaInsumoRequest(req.productoInsumoId(), req.cantidadInsumo()));
    }
    if (lineas.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un insumo");
    }
    Map<Long, BigDecimal> unidos = new LinkedHashMap<>();
    for (RecetaInsumoRequest i : lineas) {
      unidos.merge(i.productoInsumoId(), scale(i.cantidad()), BigDecimal::add);
    }
    return unidos.entrySet().stream()
        .map(e -> new RecetaInsumoRequest(e.getKey(), e.getValue()))
        .toList();
  }

  /** Pasa fórmulas viejas (solo columnas) a líneas receta_insumos. */
  private void migrarInsumosLegacy() {
    for (Receta r : repo.findAllByOrderByIdAsc()) {
      if (r.getInsumos() != null && !r.getInsumos().isEmpty()) continue;
      if (r.getProductoInsumo() == null || r.getCantidadInsumo() == null) continue;
      RecetaInsumo ri = new RecetaInsumo();
      ri.setProducto(r.getProductoInsumo());
      ri.setCantidad(scale(r.getCantidadInsumo()));
      ri.setTenantId(r.getTenantId());
      r.addInsumo(ri);
      repo.save(r);
    }
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
      if ("fabuloso bosque de limon".equals(key)) {
        sembrarMixBosqueLimon(resultado, productos, cfg);
        continue;
      }
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
      Optional<Producto> insumoOpt = buscarProducto(productos, insumoNombre);
      if (insumoOpt.isEmpty()) continue;
      Receta r = new Receta();
      r.setProductoResultado(resultado);
      r.setProductoInsumo(insumoOpt.get());
      BigDecimal prod;
      BigDecimal agua;
      BigDecimal ins;
      if ("cloro".equals(key)) {
        prod = scale(cfg.getCloroProducto());
        agua = scale(cfg.getCloroAgua());
        ins = scale(cfg.getCloroInsumo());
      } else {
        prod = scale(cfg.getFabulosoProducto());
        agua = scale(cfg.getFabulosoAgua());
        ins = scale(cfg.getFabulosoInsumo());
      }
      r.setCantidadProducto(prod);
      r.setCantidadAgua(agua);
      r.setCantidadInsumo(ins);
      RecetaInsumo ri = new RecetaInsumo();
      ri.setProducto(insumoOpt.get());
      ri.setCantidad(ins);
      r.addInsumo(ri);
      repo.save(r);
    }
  }

  /** 16 L = 15 L agua + 0.5 L base bosques + 0.5 L base limón. */
  private void sembrarMixBosqueLimon(Producto resultado, List<Producto> productos, RecetaConfig cfg) {
    Optional<Producto> bosques = buscarProducto(productos, "Base Fabuloso Bosques");
    Optional<Producto> limon = buscarProducto(productos, "Base Fabuloso Limon");
    if (bosques.isEmpty() || limon.isEmpty()) {
      Optional<Producto> solo = limon.isPresent() ? limon : bosques;
      if (solo.isEmpty()) return;
      Receta r = new Receta();
      r.setProductoResultado(resultado);
      r.setProductoInsumo(solo.get());
      r.setCantidadProducto(scale(cfg.getFabulosoProducto()));
      r.setCantidadAgua(scale(cfg.getFabulosoAgua()));
      r.setCantidadInsumo(scale(cfg.getFabulosoInsumo()));
      RecetaInsumo ri = new RecetaInsumo();
      ri.setProducto(solo.get());
      ri.setCantidad(scale(cfg.getFabulosoInsumo()));
      r.addInsumo(ri);
      repo.save(r);
      return;
    }
    BigDecimal prod = scale(cfg.getFabulosoProducto());
    BigDecimal agua = scale(cfg.getFabulosoAgua());
    BigDecimal mitad = scale(cfg.getFabulosoInsumo()).divide(new BigDecimal("2"), 4, RoundingMode.HALF_UP);
    Receta r = new Receta();
    r.setProductoResultado(resultado);
    r.setProductoInsumo(bosques.get());
    r.setCantidadProducto(prod);
    r.setCantidadAgua(agua);
    r.setCantidadInsumo(mitad.add(mitad));
    RecetaInsumo a = new RecetaInsumo();
    a.setProducto(bosques.get());
    a.setCantidad(mitad);
    RecetaInsumo b = new RecetaInsumo();
    b.setProducto(limon.get());
    b.setCantidad(mitad);
    r.addInsumo(a);
    r.addInsumo(b);
    repo.save(r);
  }

  private Optional<Producto> buscarProducto(List<Producto> productos, String nombre) {
    String buscar = normalizar(nombre);
    return productos.stream()
        .filter(p -> p.isActivo() && normalizar(p.getNombre()).equals(buscar))
        .findFirst();
  }

  private void validarSuma(BigDecimal producto, BigDecimal agua, BigDecimal insumos) {
    BigDecimal suma = nz(agua).add(nz(insumos));
    if (suma.subtract(nz(producto)).abs().compareTo(new BigDecimal("0.0001")) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Agua + insumos debe ser igual a la cantidad de producto ("
              + producto
              + " = "
              + agua
              + " + "
              + insumos
              + ")");
    }
  }

  private static BigDecimal sumaInsumos(Receta r) {
    if (r.getInsumos() != null && !r.getInsumos().isEmpty()) {
      return r.getInsumos().stream()
          .map(i -> nz(i.getCantidad()))
          .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    return nz(r.getCantidadInsumo());
  }

  private static BigDecimal ratio(BigDecimal parte, BigDecimal total) {
    BigDecimal t = nz(total);
    if (t.compareTo(BigDecimal.ZERO) <= 0) {
      return BigDecimal.ZERO;
    }
    return nz(parte).divide(t, 8, RoundingMode.HALF_UP);
  }

  RecetaDto toDto(Receta r) {
    asegurarLineasEnMemoria(r);
    Producto res = r.getProductoResultado();
    List<RecetaInsumoDto> insumos =
        r.getInsumos().stream()
            .map(
                i ->
                    new RecetaInsumoDto(
                        i.getProducto().getId(),
                        i.getProducto().getNombre(),
                        scale(i.getCantidad())))
            .toList();
    Producto primero = r.getProductoInsumo();
    BigDecimal total = sumaInsumos(r);
    return new RecetaDto(
        r.getId(),
        res.getId(),
        res.getNombre(),
        primero != null ? primero.getId() : (insumos.isEmpty() ? null : insumos.get(0).productoInsumoId()),
        primero != null
            ? primero.getNombre()
            : (insumos.isEmpty() ? null : insumos.get(0).productoInsumoNombre()),
        scale(r.getCantidadProducto()),
        scale(r.getCantidadAgua()),
        scale(total),
        insumos);
  }

  private void asegurarLineasEnMemoria(Receta r) {
    if (r.getInsumos() != null && !r.getInsumos().isEmpty()) return;
    if (r.getProductoInsumo() == null) return;
    RecetaInsumo ri = new RecetaInsumo();
    ri.setProducto(r.getProductoInsumo());
    ri.setCantidad(scale(r.getCantidadInsumo()));
    r.addInsumo(ri);
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
