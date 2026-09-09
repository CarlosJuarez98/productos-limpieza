package com.productoslimpieza.web;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> handle(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode())
        .body(Map.of("error", ex.getReason() != null ? ex.getReason() : ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
    String msg = ex.getBindingResult().getFieldErrors().stream()
        .findFirst()
        .map(e -> e.getField() + ": " + e.getDefaultMessage())
        .orElse("Datos inválidos");
    return ResponseEntity.badRequest().body(Map.of("error", msg));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, String>> handleIllegal(IllegalArgumentException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<Map<String, String>> handleData(DataIntegrityViolationException ex) {
    log.error("Violación de integridad", ex);
    String msg = ex.getMostSpecificCause() != null
        ? ex.getMostSpecificCause().getMessage()
        : "No se pudo guardar (dato inválido o restricción de BD)";
    if (msg != null && msg.contains("CANTIDAD") && msg.contains("TRASPASOS")) {
      msg = "Error de esquema legado en traspasos. Reinicia o aplica el ajuste de columnas.";
    }
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", msg));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleOther(Exception ex) {
    log.error("Error no controlado en API", ex);
    String msg = ex.getMessage() != null && !ex.getMessage().isBlank()
        ? ex.getMessage()
        : "Error interno del servidor";
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", msg));
  }
}
