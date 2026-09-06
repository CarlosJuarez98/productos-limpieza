package com.productoslimpieza.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

  @Bean
  public WebMvcConfigurer corsConfigurer() {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "http://127.0.0.1:4202",
                "http://localhost:4202",
                "http://127.0.0.1:8083",
                "http://localhost:8083")
            .allowedMethods("*")
            .allowedHeaders("*");
      }
    };
  }
}
