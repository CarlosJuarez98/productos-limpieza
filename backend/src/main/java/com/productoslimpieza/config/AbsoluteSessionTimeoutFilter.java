package com.productoslimpieza.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Sesión deslizante de 20 minutos. Si hay petición con sesión viva, se renueva;
 * si pasan 20 min sin uso, se invalida.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AbsoluteSessionTimeoutFilter extends OncePerRequestFilter {

  /** Inicio de sesión (ms, fijo tras login). */
  public static final String LOGIN_AT_ATTR = "pl.loginAtMillis";
  /** Duración máxima acordada en login (ms). */
  public static final String ATTR_TIMEOUT_MS = "pl.sessionTimeoutMs";
  public static final long MAX_SESSION_MS = 20L * 60L * 1000L;
  public static final long RECORDAR_SESSION_MS = 7L * 24L * 60L * 60L * 1000L;
  public static final int MAX_SESSION_SECONDS = (int) (MAX_SESSION_MS / 1000L);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    HttpSession session = request.getSession(false);
    if (session != null) {
      Object loginAt = session.getAttribute(LOGIN_AT_ATTR);
      if (loginAt instanceof Long started) {
        long timeoutMs = timeoutMs(session);
        long now = System.currentTimeMillis();
        if (now - started > timeoutMs) {
          try {
            session.invalidate();
          } catch (IllegalStateException ignored) {
            /* ya invalidada */
          }
          SecurityContextHolder.clearContext();
        } else {
          int inactiveSec = (int) Math.min(Integer.MAX_VALUE, timeoutMs / 1000L);
          session.setMaxInactiveInterval(inactiveSec);
        }
      }
    }
    filterChain.doFilter(request, response);
  }

  public static long timeoutMs(HttpSession session) {
    Object stored = session.getAttribute(ATTR_TIMEOUT_MS);
    if (stored instanceof Long ms && ms > 0) {
      return ms;
    }
    if (stored instanceof Integer sec && sec > 0) {
      return sec.longValue() * 1000L;
    }
    return MAX_SESSION_MS;
  }
}
