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
 * Limita la sesión a 20 minutos desde el login (no solo por inactividad).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AbsoluteSessionTimeoutFilter extends OncePerRequestFilter {

  public static final String LOGIN_AT_ATTR = "pl.loginAtMillis";
  public static final long MAX_SESSION_MS = 20L * 60L * 1000L;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    HttpSession session = request.getSession(false);
    if (session != null) {
      Object loginAt = session.getAttribute(LOGIN_AT_ATTR);
      if (loginAt instanceof Long started) {
        long age = System.currentTimeMillis() - started;
        if (age > MAX_SESSION_MS) {
          session.invalidate();
          SecurityContextHolder.clearContext();
        }
      }
    }
    filterChain.doFilter(request, response);
  }
}
