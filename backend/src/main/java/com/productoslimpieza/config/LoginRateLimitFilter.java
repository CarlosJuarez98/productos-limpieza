package com.productoslimpieza.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Limita intentos fallidos de login por IP: 20 en 15 minutos. */
public class LoginRateLimitFilter extends OncePerRequestFilter {

  static final int MAX_FAILS = 20;
  static final long WINDOW_MS = 15L * 60L * 1000L;

  private final ConcurrentHashMap<String, List<Long>> failsByIp = new ConcurrentHashMap<>();
  private final ObjectMapper mapper = new ObjectMapper();

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (!isLoginPost(request)) {
      filterChain.doFilter(request, response);
      return;
    }
    String ip = clientIp(request);
    if (isBlocked(ip)) {
      response.setStatus(429);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      mapper.writeValue(
          response.getOutputStream(),
          Map.of("error", "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."));
      return;
    }
    filterChain.doFilter(request, response);
    if (response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
      recordFail(ip);
    }
  }

  private static boolean isLoginPost(HttpServletRequest request) {
    return HttpMethod.POST.matches(request.getMethod())
        && "/api/auth/login".equals(request.getRequestURI());
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      int comma = forwarded.indexOf(',');
      return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
    }
    return request.getRemoteAddr();
  }

  private boolean isBlocked(String ip) {
    prune(ip, System.currentTimeMillis());
    List<Long> times = failsByIp.get(ip);
    return times != null && times.size() >= MAX_FAILS;
  }

  private void recordFail(String ip) {
    long now = System.currentTimeMillis();
    failsByIp.compute(ip, (k, v) -> {
      List<Long> list = v != null ? v : new ArrayList<>();
      pruneList(list, now);
      list.add(now);
      return list;
    });
  }

  private void prune(String ip, long now) {
    failsByIp.computeIfPresent(ip, (k, list) -> {
      pruneList(list, now);
      return list.isEmpty() ? null : list;
    });
  }

  private static void pruneList(List<Long> list, long now) {
    list.removeIf(t -> now - t > WINDOW_MS);
  }
}
