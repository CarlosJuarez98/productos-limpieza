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

  /** Última actividad (ms). */
  public static final String LOGIN_AT_ATTR = "pl.loginAtMillis";
  public static final long MAX_SESSION_MS = 20L * 60L * 1000L;
  public static final int MAX_SESSION_SECONDS = (int) (MAX_SESSION_MS / 1000L);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    HttpSession session = request.getSession(false);
    if (session != null) {
      Object lastAt = session.getAttribute(LOGIN_AT_ATTR);
      if (lastAt instanceof Long started) {
        long now = System.currentTimeMillis();
        if (now - started > MAX_SESSION_MS) {
          try {
            session.invalidate();
          } catch (IllegalStateException ignored) {
            /* ya invalidada */
          }
          SecurityContextHolder.clearContext();
        } else {
          session.setAttribute(LOGIN_AT_ATTR, now);
          session.setMaxInactiveInterval(MAX_SESSION_SECONDS);
        }
      }
    }
    filterChain.doFilter(request, response);
  }
}
