package com.productoslimpieza.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS adicional vía WebMvc (credenciales). La fuente principal está en SecurityConfig.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

  @Value("${app.cors.allowed-origins}")
  private String allowedOrigins;

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    List<String> origins = Arrays.stream(allowedOrigins.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toList();
    registry.addMapping("/api/**")
        .allowedOrigins(origins.toArray(String[]::new))
        .allowedMethods("*")
        .allowedHeaders("*")
        .allowCredentials(true);
  }
}
