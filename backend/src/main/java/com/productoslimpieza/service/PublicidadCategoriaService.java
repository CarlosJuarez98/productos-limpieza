package com.productoslimpieza.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.PublicidadCategoriaDto;
import com.productoslimpieza.web.dto.PublicidadCategoriaRequest;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Categorías de publicidad editables por tenant.
 *
 * <p>Viven en {@code uploads/publicidad-categorias/{tenant}/} (manifiesto + imágenes subidas).
 */
@Service
public class PublicidadCategoriaService {

  private static final Logger log = LoggerFactory.getLogger(PublicidadCategoriaService.class);
  private static final Set<String> EXT_OK = Set.of("jpg", "jpeg", "png", "webp", "gif");
  private static final long MAX_BYTES = 8L * 1024 * 1024;

  private final ObjectMapper mapper;
  private final Path root;
  private final ReentrantLock lock = new ReentrantLock();

  public PublicidadCategoriaService(
      ObjectMapper mapper,
      @Value("${app.publicidad.categorias-path:./uploads/publicidad-categorias}") String path) {
    this.mapper = mapper;
    this.root = resolveRoot(path);
  }

  private static Path resolveRoot(String path) {
    Path configured = Path.of(path);
    if (configured.isAbsolute()) return configured.normalize();
    Path userDir = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize();
    if (userDir.getFileName() != null && "backend".equalsIgnoreCase(userDir.getFileName().toString())) {
      Path parent = userDir.getParent();
      if (parent != null) {
        return parent.resolve("uploads/publicidad-categorias").normalize();
      }
    }
    return userDir.resolve(configured).normalize();
  }

  @PostConstruct
  void init() throws IOException {
    Files.createDirectories(root);
  }

  public List<PublicidadCategoriaDto> listar() {
    lock.lock();
    try {
      return leer().stream().map(this::toDto).toList();
    } catch (Exception e) {
      log.error("No se pudieron leer categorías publicidad ({})", tenantDirSafe(), e);
      // Mejor lista vacía que tumbar la pantalla de publicidad con un modal.
      return List.of();
    } finally {
      lock.unlock();
    }
  }

  public PublicidadCategoriaDto crear(PublicidadCategoriaRequest req) {
    lock.lock();
    try {
      validar(req);
      List<ManifestItem> items = new ArrayList<>(leer());
      String id = "cat-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
      int orden = req.orden() != null ? req.orden() : siguienteOrden(items);
      ManifestItem m =
          new ManifestItem(
              id,
              req.nombre().trim(),
              depto(req.departamento()),
              normalizarIds(req.productoIds()),
              blankToNull(req.slogan()),
              null,
              blankToNull(req.imagenEstatica()),
              orden);
      items.add(m);
      escribir(items);
      return toDto(m);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la categoría");
    } finally {
      lock.unlock();
    }
  }

  public PublicidadCategoriaDto actualizar(String id, PublicidadCategoriaRequest req) {
    lock.lock();
    try {
      validar(req);
      List<ManifestItem> items = new ArrayList<>(leer());
      int idx = indexOf(items, id);
      if (idx < 0) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada");
      }
      ManifestItem prev = items.get(idx);
      int orden = req.orden() != null ? req.orden() : prev.orden();
      String staticSrc = blankToNull(req.imagenEstatica());
      // Si hay archivo custom, no pisar con estática salvo que la manden explícita y limpien file.
      ManifestItem next =
          new ManifestItem(
              prev.id(),
              req.nombre().trim(),
              depto(req.departamento()),
              normalizarIds(req.productoIds()),
              blankToNull(req.slogan()),
              prev.file(),
              staticSrc != null ? staticSrc : prev.staticSrc(),
              orden);
      items.set(idx, next);
      escribir(items);
      return toDto(next);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo actualizar");
    } finally {
      lock.unlock();
    }
  }

  public void eliminar(String id) {
    lock.lock();
    try {
      List<ManifestItem> items = new ArrayList<>(leer());
      int idx = indexOf(items, id);
      if (idx < 0) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada");
      }
      ManifestItem removed = items.remove(idx);
      escribir(items);
      if (removed.file() != null && !removed.file().isBlank()) {
        Files.deleteIfExists(tenantDir().resolve(removed.file()));
      }
    } catch (ResponseStatusException e) {
      throw e;
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo eliminar");
    } finally {
      lock.unlock();
    }
  }

  public PublicidadCategoriaDto subirImagen(String id, MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta la imagen");
    }
    if (file.getSize() > MAX_BYTES) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen supera 8 MB");
    }
    String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "img.jpg";
    String ext = extension(original);
    if (!EXT_OK.contains(ext)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usa JPG, PNG, WEBP o GIF");
    }
    lock.lock();
    try {
      List<ManifestItem> items = new ArrayList<>(leer());
      int idx = indexOf(items, id);
      if (idx < 0) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada");
      }
      ManifestItem prev = items.get(idx);
      Path dir = tenantDir();
      Files.createDirectories(dir);
      String nombre = "img-" + id + "." + ext;
      Path dest = dir.resolve(nombre).normalize();
      if (!dest.startsWith(dir)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre inválido");
      }
      if (prev.file() != null && !prev.file().isBlank() && !prev.file().equals(nombre)) {
        Files.deleteIfExists(dir.resolve(prev.file()));
      }
      try (InputStream in = file.getInputStream()) {
        Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
      }
      ManifestItem next =
          new ManifestItem(
              prev.id(),
              prev.nombre(),
              prev.departamento(),
              prev.productoIds(),
              prev.slogan(),
              nombre,
              null,
              prev.orden());
      items.set(idx, next);
      escribir(items);
      return toDto(next);
    } finally {
      lock.unlock();
    }
  }

  public PublicidadCategoriaDto quitarImagen(String id) {
    lock.lock();
    try {
      List<ManifestItem> items = new ArrayList<>(leer());
      int idx = indexOf(items, id);
      if (idx < 0) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada");
      }
      ManifestItem prev = items.get(idx);
      if (prev.file() != null && !prev.file().isBlank()) {
        Files.deleteIfExists(tenantDir().resolve(prev.file()));
      }
      ManifestItem next =
          new ManifestItem(
              prev.id(),
              prev.nombre(),
              prev.departamento(),
              prev.productoIds(),
              prev.slogan(),
              null,
              prev.staticSrc(),
              prev.orden());
      items.set(idx, next);
      escribir(items);
      return toDto(next);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo quitar la imagen");
    } finally {
      lock.unlock();
    }
  }

  public Resource archivo(String nombre) throws IOException {
    String safe = sanitizarArchivo(nombre);
    // Buscar en todos los tenants (URL no lleva tenant; el nombre incluye el id de categoría).
    try (var stream = Files.list(root)) {
      for (Path tenantDir : stream.toList()) {
        if (!Files.isDirectory(tenantDir)) continue;
        Path f = tenantDir.resolve(safe).normalize();
        if (f.startsWith(tenantDir) && Files.isRegularFile(f)) {
          Resource res = new UrlResource(f.toUri());
          if (res.exists() && res.isReadable()) return res;
        }
      }
    }
    // Tenant actual primero (por si root vacío en list)
    Path local = tenantDir().resolve(safe).normalize();
    if (local.startsWith(tenantDir()) && Files.isRegularFile(local)) {
      return new UrlResource(local.toUri());
    }
    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagen no encontrada");
  }

  public String contentType(String nombre) throws IOException {
    String safe = sanitizarArchivo(nombre);
    try (var stream = Files.list(root)) {
      for (Path tenantDir : stream.toList()) {
        Path f = tenantDir.resolve(safe).normalize();
        if (Files.isRegularFile(f)) {
          try (var in = Files.newInputStream(f)) {
            return sniff(in.readNBytes(4), safe);
          }
        }
      }
    } catch (IOException ignored) {
      // fall through
    }
    return byExt(safe);
  }

  private PublicidadCategoriaDto toDto(ManifestItem m) {
    boolean custom = m.file() != null && !m.file().isBlank();
    String src;
    if (custom) {
      src = "/api/publicidad/categorias/archivo/" + m.file();
    } else if (m.staticSrc() != null && !m.staticSrc().isBlank()) {
      src = m.staticSrc();
    } else {
      src = null;
    }
    return new PublicidadCategoriaDto(
        m.id(),
        m.nombre(),
        m.departamento(),
        m.productoIds() != null ? m.productoIds() : List.of(),
        m.slogan(),
        src,
        custom,
        m.orden());
  }

  private List<ManifestItem> leer() throws IOException {
    Path dir = tenantDir();
    Files.createDirectories(dir);
    Path manifest = dir.resolve("categorias.json");
    if (!Files.exists(manifest)) {
      List<ManifestItem> seed = semilla();
      escribir(seed);
      log.info("Categorías publicidad: semilla en {}", manifest);
      return seed;
    }
    byte[] bytes = Files.readAllBytes(manifest);
    if (bytes.length == 0) return List.of();
    JsonNode root = mapper.readTree(bytes);
    if (root == null || !root.isArray()) {
      log.warn("categorias.json inválido en {}; se regenera semilla", manifest);
      List<ManifestItem> seed = semilla();
      escribir(seed);
      return seed;
    }
    List<ManifestItem> items = new ArrayList<>();
    boolean migrated = false;
    for (JsonNode n : root) {
      ManifestItem parsed = parseItem(n);
      if (parsed != null) {
        items.add(parsed);
        if (n.has("palabrasClave") && !n.has("productoIds")) migrated = true;
      }
    }
    items.sort(Comparator.comparingInt(ManifestItem::orden).thenComparing(ManifestItem::nombre));
    if (migrated) {
      escribir(items);
      log.info("Categorías publicidad: migrado palabrasClave → productoIds en {}", manifest);
    }
    return items;
  }

  /** Acepta manifiesto nuevo (productoIds) y viejo (palabrasClave ignoradas). */
  private ManifestItem parseItem(JsonNode n) {
    if (n == null || !n.isObject()) return null;
    String id = text(n, "id");
    String nombre = text(n, "nombre");
    if (id == null || nombre == null) return null;
    String departamento;
    try {
      departamento = depto(text(n, "departamento"));
    } catch (ResponseStatusException e) {
      departamento = "LIMPIEZA";
    }
    List<Long> productoIds = new ArrayList<>();
    JsonNode ids = n.get("productoIds");
    if (ids != null && ids.isArray()) {
      for (JsonNode x : ids) {
        if (x == null || x.isNull()) continue;
        if (x.isNumber()) productoIds.add(x.longValue());
        else if (x.isTextual()) {
          try {
            productoIds.add(Long.parseLong(x.asText().trim()));
          } catch (NumberFormatException ignored) {
            // skip
          }
        }
      }
    }
    String slogan = text(n, "slogan");
    String file = text(n, "file");
    String staticSrc = text(n, "staticSrc");
    int orden = n.has("orden") && n.get("orden").isNumber() ? n.get("orden").asInt() : 0;
    return new ManifestItem(
        id, nombre, departamento, normalizarIds(productoIds), slogan, file, staticSrc, orden);
  }

  private static String text(JsonNode n, String field) {
    JsonNode v = n.get(field);
    if (v == null || v.isNull()) return null;
    String s = v.asText();
    return s == null || s.isBlank() ? null : s.trim();
  }

  private String tenantDirSafe() {
    try {
      return tenantDir().toString();
    } catch (Exception e) {
      return "(sin tenant)";
    }
  }

  private void escribir(List<ManifestItem> items) throws IOException {
    Path dir = tenantDir();
    Files.createDirectories(dir);
    Path manifest = dir.resolve("categorias.json");
    items.sort(Comparator.comparingInt(ManifestItem::orden).thenComparing(ManifestItem::nombre));
    mapper.writerWithDefaultPrettyPrinter().writeValue(manifest.toFile(), items);
  }

  private Path tenantDir() {
    String tenant = TenantContext.require();
    return root.resolve(tenant).normalize();
  }

  private static int indexOf(List<ManifestItem> items, String id) {
    for (int i = 0; i < items.size(); i++) {
      if (items.get(i).id().equals(id)) return i;
    }
    return -1;
  }

  private static int siguienteOrden(List<ManifestItem> items) {
    return items.stream().mapToInt(ManifestItem::orden).max().orElse(0) + 10;
  }

  private static void validar(PublicidadCategoriaRequest req) {
    if (req == null || req.nombre() == null || req.nombre().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el nombre de la categoría");
    }
    depto(req.departamento());
  }

  private static String depto(String raw) {
    String d = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    if ("JARCERIA".equals(d) || "JARCERÍA".equals(d)) return "JARCERIA";
    if ("LIMPIEZA".equals(d) || d.isBlank()) return "LIMPIEZA";
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Departamento: LIMPIEZA o JARCERIA");
  }

  private static List<Long> normalizarIds(List<Long> ids) {
    if (ids == null || ids.isEmpty()) return List.of();
    List<Long> out = new ArrayList<>();
    for (Long id : ids) {
      if (id == null || id <= 0) continue;
      if (!out.contains(id)) out.add(id);
    }
    return out;
  }

  private static String blankToNull(String s) {
    if (s == null) return null;
    String t = s.trim();
    return t.isEmpty() ? null : t;
  }

  private static String extension(String name) {
    int i = name.lastIndexOf('.');
    if (i < 0) return "";
    return name.substring(i + 1).toLowerCase(Locale.ROOT);
  }

  private static String sanitizarArchivo(String nombre) {
    if (nombre == null || nombre.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre vacío");
    }
    String n = nombre.trim().replace('\\', '/');
    int slash = n.lastIndexOf('/');
    if (slash >= 0) n = n.substring(slash + 1);
    if (n.contains("..") || n.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre inválido");
    }
    String ext = extension(n);
    if (!EXT_OK.contains(ext)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Extensión no permitida");
    }
    return n;
  }

  private static String sniff(byte[] head, String safe) {
    if (head.length >= 3 && (head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8) return "image/jpeg";
    if (head.length >= 4
        && (head[0] & 0xff) == 0x89
        && head[1] == 0x50
        && head[2] == 0x4e
        && head[3] == 0x47) return "image/png";
    if (head.length >= 4 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F') {
      return "image/webp";
    }
    if (head.length >= 3 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F') return "image/gif";
    return byExt(safe);
  }

  private static String byExt(String safe) {
    return switch (extension(safe)) {
      case "png" -> "image/png";
      case "webp" -> "image/webp";
      case "gif" -> "image/gif";
      default -> "image/jpeg";
    };
  }

  private static List<ManifestItem> semilla() {
    return List.of(
        seed("suavizante", "Suavizantes", "LIMPIEZA",
            "¡ROPA SUAVE Y PERFUMADA AL PRECIO DEL GRANEL!",
            "/publicidad/prod-suavizante.jpg", 10),
        seed("lavado", "Lavado / detergente", "LIMPIEZA",
            "¡LAVA MÁS ROPA Y GASTA MENOS EN CADA LITRO!",
            "/publicidad/prod-detergente.jpg", 20),
        seed("cocina", "Trastes / cocina", "LIMPIEZA",
            "¡DESENGRASA FUERTE Y AHORRA EN CADA LITRO!",
            "/publicidad/prod-trastes.jpg", 30),
        seed("aroma", "Aromatizantes", "LIMPIEZA",
            "¡AROMA QUE LLENA TU CASA AL PRECIO DEL GRANEL!",
            "/publicidad/prod-aroma.jpg", 40),
        seed("manos", "Jabón de manos", "LIMPIEZA",
            "¡MANOS LIMPIAS Y SUAVES, LITRO A BUEN PRECIO!",
            "/publicidad/prod-manos.jpg", 50),
        seed("jarceria", "Jarcería", "JARCERIA",
            "¡TODO PARA DEJAR TU CASA IMPECABLE!",
            "/publicidad/prod-jarceria.jpg", 60));
  }

  private static ManifestItem seed(
      String id,
      String nombre,
      String depto,
      String slogan,
      String staticSrc,
      int orden) {
    return new ManifestItem(id, nombre, depto, List.of(), slogan, null, staticSrc, orden);
  }

  /** Persistido en categorias.json. Un producto puede estar en varias categorías. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ManifestItem(
      String id,
      String nombre,
      String departamento,
      List<Long> productoIds,
      String slogan,
      String file,
      String staticSrc,
      int orden
  ) {}
}
