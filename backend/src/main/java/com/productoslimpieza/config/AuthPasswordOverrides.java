package com.productoslimpieza.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;

/** Contraseñas en texto plano en archivo local (solo admin/mama). */
public final class AuthPasswordOverrides {

  private AuthPasswordOverrides() {}

  public static Map<String, String> load(Path path) {
    Map<String, String> out = new LinkedHashMap<>();
    if (path == null || !Files.isRegularFile(path)) {
      return out;
    }
    Properties props = new Properties();
    try (InputStream in = Files.newInputStream(path)) {
      props.load(in);
    } catch (IOException ex) {
      return out;
    }
    for (String name : props.stringPropertyNames()) {
      String user = normalizeUsername(name);
      if (!user.isEmpty()) {
        out.put(user, props.getProperty(name));
      }
    }
    return out;
  }

  public static void savePassword(Path path, String username, String plainPassword) throws IOException {
    String user = normalizeUsername(username);
    Properties props = new Properties();
    if (Files.isRegularFile(path)) {
      try (InputStream in = Files.newInputStream(path)) {
        props.load(in);
      }
    }
    Path parent = path.getParent();
    if (parent != null) {
      Files.createDirectories(parent);
    }
    props.setProperty(user, plainPassword);
    try (OutputStream out = Files.newOutputStream(path)) {
      props.store(out, "productos-limpieza auth overrides");
    }
  }

  public static String resolvePassword(
      String username, String defaultPlain, Map<String, String> overrides) {
    String key = normalizeUsername(username);
    return overrides.getOrDefault(key, defaultPlain);
  }

  static String normalizeUsername(String raw) {
    if (raw == null) return "";
    return java.text.Normalizer.normalize(raw.trim(), java.text.Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .toLowerCase(Locale.ROOT);
  }
}
