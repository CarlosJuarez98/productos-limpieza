package com.productoslimpieza.service;

import com.productoslimpieza.domain.ApartadoRubro;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.repo.ApartadoRubroRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.ApartadoRubroDto;
import com.productoslimpieza.web.dto.ApartadoRubroRequest;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApartadoRubroService {

  private static final List<Seed> DEFAULTS =
      List.of(
          new Seed(CategoriaApartado.PRODUCTOS.name(), "Productos", 1, true),
          new Seed(CategoriaApartado.CASA.name(), "Casa", 2, true),
          new Seed(CategoriaApartado.SALARIOS.name(), "Salarios", 3, true));

  private final ApartadoRubroRepository rubroRepo;
  private final ApartadoRepository apartadoRepo;

  public ApartadoRubroService(ApartadoRubroRepository rubroRepo, ApartadoRepository apartadoRepo) {
    this.rubroRepo = rubroRepo;
    this.apartadoRepo = apartadoRepo;
  }

  @Transactional
  public void asegurarDefaults() {
    String tenant = TenantContext.get();
    if (tenant == null || tenant.isBlank()) {
      return;
    }
    for (Seed s : DEFAULTS) {
      if (rubroRepo.existsByCodigoIgnoreCase(s.codigo())) {
        continue;
      }
      ApartadoRubro r = new ApartadoRubro();
      r.setCodigo(s.codigo());
      r.setNombre(s.nombre());
      r.setOrden(s.orden());
      r.setLiquidaCorte(s.liquidaCorte());
      r.setActivo(true);
      r.setTenantId(tenant);
      rubroRepo.save(r);
    }
  }

  @Transactional
  public List<ApartadoRubroDto> listarActivos() {
    asegurarDefaults();
    return rubroRepo.findByActivoTrueOrderByOrdenAscIdAsc().stream().map(this::toDto).toList();
  }

  @Transactional
  public List<String> codigosLiquidaCorte() {
    asegurarDefaults();
    List<String> codes =
        rubroRepo.findByActivoTrueAndLiquidaCorteTrueOrderByOrdenAscIdAsc().stream()
            .map(ApartadoRubro::getCodigo)
            .toList();
    if (!codes.isEmpty()) {
      return codes;
    }
    return DEFAULTS.stream().map(Seed::codigo).toList();
  }

  @Transactional
  public ApartadoRubroDto crear(ApartadoRubroRequest req) {
    asegurarDefaults();
    String nombre = req.nombre().trim();
    if (nombre.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el nombre del apartado");
    }
    if (nombre.length() > 80) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre demasiado largo");
    }
    String codigo = nuevoCodigo(nombre);
    int orden =
        rubroRepo.findByActivoTrueOrderByOrdenAscIdAsc().stream()
                .mapToInt(ApartadoRubro::getOrden)
                .max()
                .orElse(0)
            + 1;
    ApartadoRubro r = new ApartadoRubro();
    r.setCodigo(codigo);
    r.setNombre(nombre);
    r.setOrden(orden);
    r.setLiquidaCorte(true);
    r.setActivo(true);
    return toDto(rubroRepo.save(r));
  }

  @Transactional
  public ApartadoRubroDto renombrar(Long id, ApartadoRubroRequest req) {
    ApartadoRubro r =
        rubroRepo
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Apartado no encontrado"));
    String nombre = req.nombre().trim();
    if (nombre.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el nombre del apartado");
    }
    if (nombre.length() > 80) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre demasiado largo");
    }
    r.setNombre(nombre);
    return toDto(rubroRepo.save(r));
  }

  /**
   * Desactiva el rubro. Solo si no tiene movimientos (para no ocultar historial).
   * Debe quedar al menos un apartado activo.
   */
  @Transactional
  public void eliminar(Long id) {
    ApartadoRubro r =
        rubroRepo
            .findById(id)
            .filter(ApartadoRubro::isActivo)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Apartado no encontrado"));
    long activos = rubroRepo.findByActivoTrueOrderByOrdenAscIdAsc().size();
    if (activos <= 1) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Debe quedar al menos un apartado");
    }
    long movs = apartadoRepo.countByCategoriaIgnoreCase(r.getCodigo());
    if (movs > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No se puede borrar «"
              + r.getNombre()
              + "»: tiene "
              + movs
              + " movimiento(s). Elimínalos del historial primero.");
    }
    r.setActivo(false);
    rubroRepo.save(r);
  }

  @Transactional
  public void exigirRubroUsable(String codigo) {
    asegurarDefaults();
    String c = codigo == null ? "" : codigo.trim();
    if (c.isEmpty()
        || CategoriaApartado.GENERAL.name().equalsIgnoreCase(c)
        || CategoriaApartado.SERVICIOS.name().equalsIgnoreCase(c)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoría de apartado no válida");
    }
    ApartadoRubro r =
        rubroRepo
            .findByCodigoIgnoreCase(c)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "No existe el apartado " + c));
    if (!r.isActivo()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El apartado está inactivo");
    }
  }

  private String nuevoCodigo(String nombre) {
    String base =
        Normalizer.normalize(nombre, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toUpperCase(Locale.ROOT)
            .replaceAll("[^A-Z0-9]+", "_")
            .replaceAll("^_|_$", "");
    if (base.isBlank()) {
      base = "RUBRO";
    }
    if (base.length() > 24) {
      base = base.substring(0, 24);
    }
    String codigo = base;
    int n = 0;
    while (rubroRepo.existsByCodigoIgnoreCase(codigo)
        || esReservado(codigo)) {
      n++;
      codigo = base + "_" + n;
      if (n > 50) {
        codigo = "RUBRO_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        break;
      }
    }
    return codigo;
  }

  private static boolean esReservado(String codigo) {
    for (CategoriaApartado c : CategoriaApartado.values()) {
      if (c.name().equalsIgnoreCase(codigo)) {
        return true;
      }
    }
    return false;
  }

  private ApartadoRubroDto toDto(ApartadoRubro r) {
    return new ApartadoRubroDto(
        r.getId(), r.getCodigo(), r.getNombre(), r.isActivo(), r.getOrden(), r.isLiquidaCorte());
  }

  private record Seed(String codigo, String nombre, int orden, boolean liquidaCorte) {}
}
