package com.productoslimpieza.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cron 1-ene 00:15 America/Mexico_City + reintento diario 1–7 ene (si el server
 * estuvo apagado) + intento al arrancar en esa ventana.
 */
@Component
public class ArchivoAnualScheduler {

  private static final Logger log = LoggerFactory.getLogger(ArchivoAnualScheduler.class);

  private final ArchivoAnualService service;

  public ArchivoAnualScheduler(ArchivoAnualService service) {
    this.service = service;
  }

  @Scheduled(cron = "0 15 0 1 1 ?", zone = "America/Mexico_City")
  public void primerDiaDelAnio() {
    correr("cron-1-ene");
  }

  /** Catch-up si el 1-ene el contenedor estaba caído. */
  @Scheduled(cron = "0 30 3 1-7 1 ?", zone = "America/Mexico_City")
  public void reintentoEnero() {
    correr("cron-catchup-ene");
  }

  @EventListener(ApplicationReadyEvent.class)
  public void alArrancar() {
    if (!service.isEnabled()) {
      return;
    }
    correr("startup");
  }

  private void correr(String motivo) {
    try {
      var resumen = service.ejecutarSiCorresponde(motivo);
      if (resumen != null) {
        log.info("Archivo anual OK ({}): {}", motivo, resumen.get("filasBorradas"));
      }
    } catch (Exception e) {
      log.error("Archivo anual falló ({})", motivo, e);
    }
  }
}
