package com.productoslimpieza.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Sirve archivos de {@code frontend/public/publicidad} (promos) con MIME correcto.
 *
 * <p>En local lee del disco; en Docker/JAR cae al classpath {@code static/publicidad/} embebido
 * en el fat-jar (copia del build Angular).
 */
@Service
public class PublicidadMediaService {

  private static final Set<String> EXT_OK = Set.of("jpg", "jpeg", "png", "webp", "gif");

  private final Path dir;

  public PublicidadMediaService(
      @Value("${app.publicidad.media-path:}") String configured) {
    this.dir = resolveDir(configured);
  }

  public Resource archivo(String nombre) throws IOException {
    String safe = sanitizar(nombre);
    Path f = dir.resolve(safe).normalize();
    if (f.startsWith(dir) && Files.isRegularFile(f)) {
      Resource res = new UrlResource(f.toUri());
      if (res.exists() && res.isReadable()) {
        return res;
      }
    }
    // Docker: solo app.jar → estáticos Angular en classpath
    ClassPathResource cp = new ClassPathResource("static/publicidad/" + safe);
    if (cp.exists() && cp.isReadable()) {
      return cp;
    }
    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagen no encontrada: " + safe);
  }

  public String contentType(String nombre) throws IOException {
    String safe = sanitizar(nombre);
    Path f = dir.resolve(safe).normalize();
    if (Files.isRegularFile(f)) {
      try (var in = Files.newInputStream(f)) {
        return sniff(in.readNBytes(4), safe);
      }
    }
    ClassPathResource cp = new ClassPathResource("static/publicidad/" + safe);
    if (cp.exists()) {
      try (var in = cp.getInputStream()) {
        return sniff(in.readNBytes(4), safe);
      }
    }
    return byExt(safe);
  }

  private static String sniff(byte[] head, String safe) {
    if (head.length >= 3 && (head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8) {
      return "image/jpeg";
    }
    if (head.length >= 4
        && (head[0] & 0xff) == 0x89
        && head[1] == 0x50
        && head[2] == 0x4e
        && head[3] == 0x47) {
      return "image/png";
    }
    if (head.length >= 4
        && head[0] == 'R'
        && head[1] == 'I'
        && head[2] == 'F'
        && head[3] == 'F') {
      return "image/webp";
    }
    if (head.length >= 3 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F') {
      return "image/gif";
    }
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

  private static String sanitizar(String nombre) {
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

  private static String extension(String name) {
    int i = name.lastIndexOf('.');
    if (i < 0) return "";
    return name.substring(i + 1).toLowerCase(Locale.ROOT);
  }

  private static Path resolveDir(String configured) {
    if (configured != null && !configured.isBlank()) {
      return Path.of(configured).toAbsolutePath().normalize();
    }
    Path userDir = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize();
    if (userDir.getFileName() != null && "backend".equalsIgnoreCase(userDir.getFileName().toString())) {
      Path p = userDir.getParent().resolve("frontend/public/publicidad");
      if (Files.isDirectory(p)) return p.normalize();
    }
    Path fromRoot = userDir.resolve("frontend/public/publicidad");
    if (Files.isDirectory(fromRoot)) return fromRoot.normalize();
    Path uploads = userDir.resolve("uploads/publicidad-media");
    try {
      Files.createDirectories(uploads);
    } catch (IOException ignored) {
      // ignore
    }
    return uploads.normalize();
  }
}
