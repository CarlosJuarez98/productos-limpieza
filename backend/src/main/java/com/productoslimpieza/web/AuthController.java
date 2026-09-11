package com.productoslimpieza.web;

import com.productoslimpieza.config.AbsoluteSessionTimeoutFilter;
import com.productoslimpieza.web.dto.LoginRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;

  public AuthController(
      AuthenticationManager authenticationManager,
      SecurityContextRepository securityContextRepository) {
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
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
      HttpSession session = request.getSession(true);
      session.setMaxInactiveInterval(20 * 60);
      session.setAttribute(AbsoluteSessionTimeoutFilter.LOGIN_AT_ATTR, System.currentTimeMillis());
      securityContextRepository.saveContext(context, request, response);

      return Map.of(
          "ok", true,
          "username", auth.getName(),
          "displayName", displayName(auth.getName()),
          "sessionMinutes", 20);
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

  private static long remainingMs(HttpSession session) {
    if (session == null) return 0;
    Object loginAt = session.getAttribute(AbsoluteSessionTimeoutFilter.LOGIN_AT_ATTR);
    if (!(loginAt instanceof Long started)) {
      return AbsoluteSessionTimeoutFilter.MAX_SESSION_MS;
    }
    long age = System.currentTimeMillis() - started;
    return AbsoluteSessionTimeoutFilter.MAX_SESSION_MS - age;
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
