package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Produccion;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.ProduccionRepository;
import com.productoslimpieza.web.dto.ProduccionDto;
import com.productoslimpieza.web.dto.ProduccionRequest;
import com.productoslimpieza.web.dto.RecetaSugeridaDto;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProduccionService {

  /** Nombre resultado (lower) -> nombre insumo exacto en inventario. */
  private static final Map<String, String> RECETAS = Map.ofEntries(
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
      Map.entry("fabuloso chicle", "Base Fabuloso Chicle")
  );

  private final ProduccionRepository produccionRepo;
  private final ProductoRepository productoRepo;

  public ProduccionService(ProduccionRepository produccionRepo, ProductoRepository productoRepo) {
    this.produccionRepo = produccionRepo;
    this.productoRepo = productoRepo;
  }

  @Transactional(readOnly = true)
  public List<ProduccionDto> listar() {
    return produccionRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public RecetaSugeridaDto sugerir(Long productoResultadoId) {
    Producto resultado = productoRepo.findById(productoResultadoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    Optional<Producto> insumo = resolverInsumo(resultado.getNombre());
    if (insumo.isEmpty()) {
      return new RecetaSugeridaDto(resultado.getId(), resultado.getNombre(), null, null, false);
    }
    Producto i = insumo.get();
    return new RecetaSugeridaDto(resultado.getId(), resultado.getNombre(), i.getId(), i.getNombre(), true);
  }

  @Transactional
  public ProduccionDto crear(ProduccionRequest req) {
    if (req.productoResultadoId().equals(req.productoInsumoId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El resultado y el insumo no pueden ser el mismo producto");
    }
    Producto resultado = productoRepo.findById(req.productoResultadoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto resultado no encontrado"));
    Producto insumo = productoRepo.findById(req.productoInsumoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto insumo no encontrado"));
    Produccion p = new Produccion();
    p.setFecha(req.fecha());
    p.setProductoResultado(resultado);
    p.setCantidadResultado(req.cantidadResultado());
    p.setProductoInsumo(insumo);
    p.setCantidadInsumo(req.cantidadInsumo());
    return toDto(produccionRepo.save(p));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!produccionRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producción no encontrada");
    }
    produccionRepo.deleteById(id);
  }

  private Optional<Producto> resolverInsumo(String nombreResultado) {
    String key = normalizar(nombreResultado);
    String insumoNombre = RECETAS.get(key);
    if (insumoNombre == null && key.startsWith("fabuloso ")) {
      String resto = nombreResultado.trim().substring("Fabuloso ".length()).trim();
      insumoNombre = "Base Fabuloso " + resto;
    }
    if (insumoNombre == null) {
      return Optional.empty();
    }
    return productoRepo.findByNombreIgnoreCase(insumoNombre);
  }

  private static String normalizar(String s) {
    return s == null ? "" : s.trim().toLowerCase(Locale.ROOT)
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u");
  }

  private ProduccionDto toDto(Produccion p) {
    Producto r = p.getProductoResultado();
    Producto i = p.getProductoInsumo();
    return new ProduccionDto(
        p.getId(),
        p.getFecha(),
        r.getId(),
        r.getNombre(),
        p.getCantidadResultado(),
        i.getId(),
        i.getNombre(),
        p.getCantidadInsumo()
    );
  }
}
