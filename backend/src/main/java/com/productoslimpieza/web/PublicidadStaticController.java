package com.productoslimpieza.web;

import com.productoslimpieza.service.PublicidadMediaService;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Sirve {@code /publicidad/*.jpg|png|…} con MIME correcto.
 *
 * <p>Complementa los estáticos del fat-jar: en prod a veces el resource handler no entrega bien
 * esos archivos; aquí se usa {@link PublicidadMediaService} (disco o classpath).
 */
@RestController
public class PublicidadStaticController {

  private static final Set<String> EXT_OK = Set.of("jpg", "jpeg", "png", "webp", "gif");

  private final PublicidadMediaService mediaService;

  public PublicidadStaticController(PublicidadMediaService mediaService) {
    this.mediaService = mediaService;
  }

  @GetMapping("/publicidad/{nombre}")
  public ResponseEntity<org.springframework.core.io.Resource> archivo(@PathVariable String nombre)
      throws IOException {
    if (nombre == null || nombre.isBlank() || nombre.contains("/") || nombre.contains("\\")) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    int dot = nombre.lastIndexOf('.');
    if (dot < 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    String ext = nombre.substring(dot + 1).toLowerCase(Locale.ROOT);
    if (!EXT_OK.contains(ext)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    var resource = mediaService.archivo(nombre);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_TYPE, mediaService.contentType(nombre))
        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
        .header("X-Content-Type-Options", "nosniff")
        .body(resource);
  }
}
