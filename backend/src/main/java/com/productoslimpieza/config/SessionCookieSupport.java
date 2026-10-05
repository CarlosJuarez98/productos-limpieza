package com.productoslimpieza.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

/**
 * Persiste o limpia la cookie de sesión {@code PLSESSID}.
 * Sin Max-Age el navegador la borra al cerrar (falla «Recordarme 7 días»).
 *
 * <p>Tomcat suele emitir PLSESSID al cerrar la respuesta <em>sin</em> Max-Age; el wrapper
 * reescribe esa cabecera cuando la sesión tiene {@link #ATTR_RECORDAR}.
 */
public final class SessionCookieSupport {

  public static final String COOKIE_NAME = "PLSESSID";
  public static final String ATTR_RECORDAR = "pl.recordar";

  private SessionCookieSupport() {}

  public static void write(
      HttpServletRequest request, HttpServletResponse response, int maxAgeSeconds) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      return;
    }
    response.addHeader(HttpHeaders.SET_COOKIE, build(session.getId(), maxAgeSeconds, request));
  }

  /** Cookie de sesión (se borra al cerrar el navegador). */
  public static void writeSessionOnly(HttpServletRequest request, HttpServletResponse response) {
    write(request, response, -1);
  }

  public static void clear(HttpServletRequest request, HttpServletResponse response) {
    ResponseCookie cookie =
        ResponseCookie.from(COOKIE_NAME, "")
            .path("/")
            .httpOnly(true)
            .sameSite("Lax")
            .secure(secure(request))
            .maxAge(Duration.ZERO)
            .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  public static HttpServletResponse wrapForRecordar(
      HttpServletRequest request, HttpServletResponse response) {
    return new RecordarCookieResponse(request, response);
  }

  private static String build(String sessionId, int maxAgeSeconds, HttpServletRequest request) {
    ResponseCookie.ResponseCookieBuilder b =
        ResponseCookie.from(COOKIE_NAME, sessionId)
            .path("/")
            .httpOnly(true)
            .sameSite("Lax")
            .secure(secure(request));
    if (maxAgeSeconds >= 0) {
      b.maxAge(Duration.ofSeconds(maxAgeSeconds));
    }
    return b.build().toString();
  }

  private static boolean secure(HttpServletRequest request) {
    if (request.isSecure()) {
      return true;
    }
    String proto = request.getHeader("X-Forwarded-Proto");
    return proto != null && proto.toLowerCase().startsWith("https");
  }

  private static boolean isPlsessid(String setCookie) {
    if (setCookie == null || setCookie.isBlank()) {
      return false;
    }
    int semi = setCookie.indexOf(';');
    String pair = (semi >= 0 ? setCookie.substring(0, semi) : setCookie).trim();
    int eq = pair.indexOf('=');
    String name = eq >= 0 ? pair.substring(0, eq).trim() : pair;
    return COOKIE_NAME.equalsIgnoreCase(name);
  }

  private static String rewriteIfNeeded(
      HttpServletRequest request, String setCookie, long remainingSec) {
    if (!isPlsessid(setCookie)) {
      return setCookie;
    }
    int eq = setCookie.indexOf('=');
    int semi = setCookie.indexOf(';');
    if (eq < 0) {
      return setCookie;
    }
    String value =
        (semi > eq ? setCookie.substring(eq + 1, semi) : setCookie.substring(eq + 1)).trim();
    if (value.isEmpty()) {
      return setCookie;
    }
    return build(value, (int) Math.min(Integer.MAX_VALUE, remainingSec), request);
  }

  /**
   * Reescribe Set-Cookie de PLSESSID con Max-Age = tiempo restante del tope absoluto
   * cuando la sesión tiene Recordarme.
   */
  static final class RecordarCookieResponse extends HttpServletResponseWrapper {
    private final HttpServletRequest request;

    RecordarCookieResponse(HttpServletRequest request, HttpServletResponse response) {
      super(response);
      this.request = request;
    }

    @Override
    public void addHeader(String name, String value) {
      if (HttpHeaders.SET_COOKIE.equalsIgnoreCase(name)) {
        super.addHeader(name, maybeRewrite(value));
        return;
      }
      super.addHeader(name, value);
    }

    @Override
    public void setHeader(String name, String value) {
      if (HttpHeaders.SET_COOKIE.equalsIgnoreCase(name)) {
        super.setHeader(name, maybeRewrite(value));
        return;
      }
      super.setHeader(name, value);
    }

    @Override
    public void addCookie(jakarta.servlet.http.Cookie cookie) {
      if (cookie != null && COOKIE_NAME.equalsIgnoreCase(cookie.getName())) {
        Integer maxAge = recordarMaxAgeSeconds();
        if (maxAge != null) {
          cookie.setMaxAge(maxAge);
          cookie.setPath("/");
          cookie.setHttpOnly(true);
        }
      }
      super.addCookie(cookie);
    }

    @Override
    public Collection<String> getHeaders(String name) {
      if (!HttpHeaders.SET_COOKIE.equalsIgnoreCase(name)) {
        return super.getHeaders(name);
      }
      List<String> out = new ArrayList<>();
      for (String h : super.getHeaders(name)) {
        out.add(maybeRewrite(h));
      }
      return out;
    }

    private String maybeRewrite(String setCookie) {
      Integer maxAge = recordarMaxAgeSeconds();
      if (maxAge == null) {
        return setCookie;
      }
      return rewriteIfNeeded(request, setCookie, maxAge);
    }

    private Integer recordarMaxAgeSeconds() {
      HttpSession session = request.getSession(false);
      if (session == null) {
        return null;
      }
      if (!Boolean.TRUE.equals(session.getAttribute(ATTR_RECORDAR))) {
        return null;
      }
      Object loginAt = session.getAttribute(AbsoluteSessionTimeoutFilter.LOGIN_AT_ATTR);
      if (!(loginAt instanceof Long started)) {
        return null;
      }
      long timeoutMs = AbsoluteSessionTimeoutFilter.timeoutMs(session);
      long remainingSec =
          Math.max(1L, (timeoutMs - (System.currentTimeMillis() - started)) / 1000L);
      return (int) Math.min(Integer.MAX_VALUE, remainingSec);
    }
  }
}
