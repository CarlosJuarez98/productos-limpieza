package com.productoslimpieza.web;

import com.productoslimpieza.config.AbsoluteSessionTimeoutFilter;
import com.productoslimpieza.config.AuthPasswordOverrides;
import com.productoslimpieza.web.dto.LoginRequest;
import com.productoslimpieza.web.dto.PasswordChangeRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.nio.file.Path;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;
  private final UserDetailsService userDetailsService;
  private final PasswordEncoder passwordEncoder;
  private final Path overridesPath;

  public AuthController(
      AuthenticationManager authenticationManager,
      SecurityContextRepository securityContextRepository,
      UserDetailsService userDetailsService,
      PasswordEncoder passwordEncoder,
      @Value("${app.auth.overrides-file}") String overridesFile) {
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
    this.userDetailsService = userDetailsService;
    this.passwordEncoder = passwordEncoder;
    this.overridesPath = Path.of(overridesFile).toAbsolutePath().normalize();
  }

  @PostMapping("/login")
  public Map<String, Object> login(
      @Valid @RequestBody LoginRequest body,
      HttpServletRequest request,
      HttpServletResponse response) {
    try {
      Authentication auth = authenticationManager.authenticate(
          new UsernamePasswordAuthenticationToken(normalizeUser(body.username()), body.password()));
      SecurityContext context = SecurityContextHolder.createEmptyContext();
      context.setAuthentication(auth);
      SecurityContextHolder.setContext(context);

      HttpSession old = request.getSession(false);
      if (old != null) {
        old.invalidate();
      }
      long timeoutMs =
          Boolean.TRUE.equals(body.recordar())
              ? AbsoluteSessionTimeoutFilter.RECORDAR_SESSION_MS
              : AbsoluteSessionTimeoutFilter.MAX_SESSION_MS;
      int inactiveSec = (int) Math.min(Integer.MAX_VALUE, timeoutMs / 1000L);
      HttpSession session = request.getSession(true);
      session.setMaxInactiveInterval(inactiveSec);
      session.setAttribute(AbsoluteSessionTimeoutFilter.ATTR_TIMEOUT_MS, timeoutMs);
      session.setAttribute(AbsoluteSessionTimeoutFilter.LOGIN_AT_ATTR, System.currentTimeMillis());
      securityContextRepository.saveContext(context, request, response);

      return Map.of(
          "ok", true,
          "username", auth.getName(),
          "displayName", displayName(auth.getName()),
          "recordar", Boolean.TRUE.equals(body.recordar()),
          "remainingSeconds", inactiveSec);
    } catch (AuthenticationException ex) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos");
    }
  }

  @PostMapping("/logout")
  public Map<String, Object> logout(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      session.invalidate();
    }
    SecurityContextHolder.clearContext();
    return Map.of("ok", true);
  }

  @GetMapping("/me")
  public Map<String, Object> me(HttpServletRequest request) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    boolean loggedIn = auth != null
        && auth.isAuthenticated()
        && auth.getPrincipal() != null
        && !"anonymousUser".equals(auth.getPrincipal());
    if (!loggedIn) {
      return Map.of("authenticated", false);
    }
    long remainingMs = remainingMs(request.getSession(false));
    return Map.of(
        "authenticated", true,
        "username", auth.getName(),
        "displayName", displayName(auth.getName()),
        "remainingSeconds", Math.max(0, remainingMs / 1000));
  }

  @PutMapping("/password")
  public ResponseEntity<?> cambiarPassword(@Valid @RequestBody PasswordChangeRequest body) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || !auth.isAuthenticated()
        || auth.getPrincipal() == null
        || "anonymousUser".equals(auth.getPrincipal())) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No autenticado"));
    }
    if (!(userDetailsService instanceof InMemoryUserDetailsManager manager)) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Cambio de contraseña no disponible"));
    }
    String username = normalizeUser(auth.getName());
    UserDetails user;
    try {
      user = manager.loadUserByUsername(username);
    } catch (Exception ex) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Usuario no encontrado"));
    }
    if (!passwordEncoder.matches(body.actual(), user.getPassword())) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(Map.of("error", "La contraseña actual no es correcta"));
    }
    String nueva = body.nueva().trim();
    if (nueva.length() < 8) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(Map.of("error", "La nueva contraseña debe tener al menos 8 caracteres"));
    }
    manager.updatePassword(user, passwordEncoder.encode(nueva));
    try {
      AuthPasswordOverrides.savePassword(overridesPath, username, nueva);
    } catch (Exception ex) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "No se pudo guardar la contraseña"));
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private static long remainingMs(HttpSession session) {
    if (session == null) return 0;
    Object loginAt = session.getAttribute(AbsoluteSessionTimeoutFilter.LOGIN_AT_ATTR);
    if (!(loginAt instanceof Long started)) {
      return AbsoluteSessionTimeoutFilter.MAX_SESSION_MS;
    }
    long timeoutMs = AbsoluteSessionTimeoutFilter.timeoutMs(session);
    long age = System.currentTimeMillis() - started;
    return timeoutMs - age;
  }

  /** admin / mama / mamá → minúsculas sin acento. */
  static String normalizeUser(String raw) {
    if (raw == null) return "";
    String u = java.text.Normalizer.normalize(raw.trim(), java.text.Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .toLowerCase(java.util.Locale.ROOT);
    if ("mama".equals(u) || "mamá".equals(raw.trim().toLowerCase(java.util.Locale.ROOT))) {
      return "mama";
    }
    return u;
  }

  /** Etiqueta visible: mismos permisos; solo cambia el nombre. */
  static String displayName(String username) {
    if (username == null) return "";
    String u = normalizeUser(username);
    if ("mama".equals(u)) return "Mamá";
    if ("admin".equals(u)) return "Admin";
    return username;
  }
}
