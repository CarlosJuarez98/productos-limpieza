package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.web.dto.PublicidadGaleriaItemDto;
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
 * Galería Amorcas editable.
 *
 * <p>Imágenes subidas viven en {@code uploads/publicidad-galeria/} (carpeta del proyecto). El
 * manifiesto {@code manifest.json} lista qué se muestra. Las piezas base apuntan a {@code
 * /publicidad/...} (van en el front y no se borran del disco al quitarlas de la galería).
 */
@Service
public class PublicidadGaleriaService {

  private static final Logger log = LoggerFactory.getLogger(PublicidadGaleriaService.class);
  private static final Set<String> EXT_OK = Set.of("jpg", "jpeg", "png", "webp", "gif");
  private static final long MAX_BYTES = 8L * 1024 * 1024;

  private final ObjectMapper mapper;
  private final Path dir;
  private final Path manifestPath;
  private final ReentrantLock lock = new ReentrantLock();

  public PublicidadGaleriaService(
      ObjectMapper mapper,
      @Value("${app.publicidad.galeria-path:./uploads/publicidad-galeria}") String path) {
    this.mapper = mapper;
    this.dir = resolveDir(path);
    this.manifestPath = dir.resolve("manifest.json");
  }

  /** Si el API corre desde /backend, usa la carpeta uploads/ en la raíz del repo. */
  private static Path resolveDir(String path) {
    Path configured = Path.of(path);
    if (configured.isAbsolute()) {
      return configured.normalize();
    }
    Path userDir = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize();
    if (userDir.getFileName() != null && "backend".equalsIgnoreCase(userDir.getFileName().toString())) {
      Path parent = userDir.getParent();
      if (parent != null) {
        return parent.resolve("uploads/publicidad-galeria").normalize();
      }
    }
    return userDir.resolve(configured).normalize();
  }

  @PostConstruct
  void init() throws IOException {
    Files.createDirectories(dir);
    if (!Files.exists(manifestPath)) {
      escribirManifest(semillaInicial());
      log.info("Galería Amorcas: manifiesto inicial en {}", manifestPath);
    } else {
      migrarUrlsMediaEstaticas();
    }
  }

  /**
   * Manifiestos viejos apuntaban a {@code /api/publicidad/media/...} (404 en Docker).
   * Las piezas base viven en el front: {@code /publicidad/...}.
   */
  private void migrarUrlsMediaEstaticas() throws IOException {
    lock.lock();
    try {
      List<ManifestItem> items = leerManifest();
      boolean changed = false;
      List<ManifestItem> out = new ArrayList<>(items.size());
      for (ManifestItem m : items) {
        String src = m.staticSrc();
        if (src != null && src.startsWith("/api/publicidad/media/")) {
          String nombre = src.substring("/api/publicidad/media/".length());
          out.add(
              new ManifestItem(
                  m.id(),
                  m.titulo(),
                  m.descripcion(),
                  m.file(),
                  "/publicidad/" + nombre,
                  m.textoShare(),
                  m.eliminable()));
          changed = true;
        } else {
          out.add(m);
        }
      }
      if (changed) {
        escribirManifest(out);
        log.info("Galería Amorcas: URLs /api/publicidad/media → /publicidad migradas");
      }
    } finally {
      lock.unlock();
    }
  }

  public List<PublicidadGaleriaItemDto> listar() {
    return leerManifest().stream().map(this::aDto).toList();
  }

  public PublicidadGaleriaItemDto subir(MultipartFile file, String titulo, String descripcion)
      throws IOException {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta la imagen");
    }
    if (file.getSize() > MAX_BYTES) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen supera 8 MB");
    }
    String original = file.getOriginalFilename() == null ? "imagen.jpg" : file.getOriginalFilename();
    String ext = extension(original);
    if (!EXT_OK.contains(ext)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato no permitido (jpg/png/webp/gif)");
    }

    String id = "up-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    String stored = id + "." + ext;
    Path dest = dir.resolve(stored).normalize();
    if (!dest.startsWith(dir)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre inválido");
    }

    lock.lock();
    try {
      try (InputStream in = file.getInputStream()) {
        Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
      }
      List<ManifestItem> items = new ArrayList<>(leerManifest());
      String tit =
          (titulo == null || titulo.isBlank())
              ? sinExtension(original)
              : titulo.trim();
      String desc = descripcion == null ? "" : descripcion.trim();
      items.add(
          new ManifestItem(
              id,
              tit,
              desc,
              stored,
              null,
              "Amorcas — " + tit,
              true));
      escribirManifest(items);
      return aDto(items.get(items.size() - 1));
    } finally {
      lock.unlock();
    }
  }

  public void eliminar(String id) throws IOException {
    if (id == null || id.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Id inválido");
    }
    lock.lock();
    try {
      List<ManifestItem> items = new ArrayList<>(leerManifest());
      ManifestItem found =
          items.stream()
              .filter(i -> id.equals(i.id()))
              .findFirst()
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No está en la galería"));

      items.removeIf(i -> id.equals(i.id()));
      escribirManifest(items);

      if (found.file() != null && !found.file().isBlank()) {
        Path f = dir.resolve(found.file()).normalize();
        if (f.startsWith(dir)) {
          Files.deleteIfExists(f);
        }
      }
    } finally {
      lock.unlock();
    }
  }

  public Resource archivo(String nombre) throws IOException {
    if (nombre == null || nombre.isBlank() || nombre.contains("..") || nombre.contains("/") || nombre.contains("\\")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre inválido");
    }
    Path f = dir.resolve(nombre).normalize();
    if (!f.startsWith(dir) || !Files.isRegularFile(f)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Archivo no encontrado");
    }
    Resource res = new UrlResource(f.toUri());
    if (!res.exists() || !res.isReadable()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Archivo no encontrado");
    }
    return res;
  }

  public String contentType(String nombre) {
    String ext = extension(nombre);
    return switch (ext) {
      case "png" -> "image/png";
      case "webp" -> "image/webp";
      case "gif" -> "image/gif";
      default -> "image/jpeg";
    };
  }

  private PublicidadGaleriaItemDto aDto(ManifestItem m) {
    String src =
        m.staticSrc() != null && !m.staticSrc().isBlank()
            ? m.staticSrc()
            : "/api/publicidad/galeria/archivo/" + m.file();
    return new PublicidadGaleriaItemDto(
        m.id(),
        m.titulo(),
        m.descripcion() == null ? "" : m.descripcion(),
        src,
        m.textoShare() == null || m.textoShare().isBlank()
            ? "Amorcas — " + m.titulo()
            : m.textoShare(),
        m.eliminable());
  }

  private List<ManifestItem> leerManifest() {
    lock.lock();
    try {
      if (!Files.exists(manifestPath)) {
        return semillaInicial();
      }
      byte[] bytes = Files.readAllBytes(manifestPath);
      if (bytes.length == 0) {
        return semillaInicial();
      }
      List<ManifestItem> list =
          mapper.readValue(bytes, new TypeReference<List<ManifestItem>>() {});
      list.sort(Comparator.comparing(ManifestItem::titulo, String.CASE_INSENSITIVE_ORDER));
      return list;
    } catch (IOException e) {
      log.warn("No se pudo leer manifiesto de galería: {}", e.getMessage());
      return semillaInicial();
    } finally {
      lock.unlock();
    }
  }

  private void escribirManifest(List<ManifestItem> items) throws IOException {
    Files.createDirectories(dir);
    mapper.writerWithDefaultPrettyPrinter().writeValue(manifestPath.toFile(), items);
  }

  private static String extension(String name) {
    int i = name.lastIndexOf('.');
    if (i < 0) return "";
    return name.substring(i + 1).toLowerCase(Locale.ROOT);
  }

  private static String sinExtension(String name) {
    int i = name.lastIndexOf('.');
    return i > 0 ? name.substring(0, i) : name;
  }

  private static List<ManifestItem> semillaInicial() {
    String contacto = "WhatsApp 247-120-6128 · Fracc. Los Álamos #121-C";
    return List.of(
        itemBase("chingon", "Amorcas chingón", "Logo / marca", "/publicidad/amorcas-chingon.png",
            "Amorcas — la química perfecta para tu hogar"),
        itemBase("granel", "Beneficios a granel", "Promo a granel", "/publicidad/beneficios-granel.jpg",
            "¿Ya conoces nuestros productos a granel? Ahorra con Amorcas"),
        itemBase("ropa1", "Ropa 1", "Limpieza de ropa", "/publicidad/ropa-1.jpg",
            "Tu ropa limpia y con aroma… Amorcas te ayuda"),
        itemBase("ropa2", "Ropa 2", "Limpieza de ropa", "/publicidad/ropa-2.jpg",
            "Limpieza que se nota. Amorcas"),
        itemBase("trastes", "Trastes", "Cocina y trastes", "/publicidad/trastes-1.jpg",
            "Trastes brillantes sin esfuerzo — Amorcas"),
        itemBase("coches", "Lavado de coches", "Autos", "/publicidad/lavado-coches.jpg",
            "También para tu coche — Amorcas"),
        itemBase("servicios", "Servicios y recargas", "Recargas y pagos", "/publicidad/servicios-recargas.jpg",
            "En Amorcas también hay servicios y recargas"),
        itemBase("tarjeta-f", "Tarjeta frente", contacto, "/publicidad/tarjeta-frente.jpg",
            "Amorcas · " + contacto),
        itemBase("tarjeta-a", "Tarjeta atrás", "Presentación / sello", "/publicidad/tarjeta-atras.jpg",
            "Amorcas · Soluciones de Limpieza"),
        itemBase("letras", "Logo letras azul", "Marca", "/publicidad/letras-fondo-azul.jpg",
            "Amorcas — la química perfecta para tu hogar"),
        itemBase("amorcas-c", "Amorcas C", "Arte promocional", "/publicidad/amorcas-c.jpg", "Amorcas"));
  }

  private static ManifestItem itemBase(
      String id, String titulo, String desc, String staticSrc, String share) {
    return new ManifestItem(id, titulo, desc, null, staticSrc, share, true);
  }

  /** Persistido en manifest.json */
  public record ManifestItem(
      String id,
      String titulo,
      String descripcion,
      String file,
      String staticSrc,
      String textoShare,
      boolean eliminable) {}
}
