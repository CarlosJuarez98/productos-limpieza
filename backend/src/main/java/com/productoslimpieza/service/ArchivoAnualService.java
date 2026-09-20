package com.productoslimpieza.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.ArchivoAnualLog;
import com.productoslimpieza.repo.ArchivoAnualLogRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 1 de enero: exporta movimientos del año anterior a JSON y los borra de tablas operativas.
 * No toca catálogos (productos, personas, configs, rubros, recetas) ni cortes de caja.
 */
@Service
public class ArchivoAnualService {

  private static final Logger log = LoggerFactory.getLogger(ArchivoAnualService.class);
  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
  private static final List<String> TENANTS = List.of("admin", "mama");

  private final boolean enabled;
  private final boolean dryRun;
  private final Path basePath;
  private final JdbcTemplate jdbc;
  private final ObjectMapper mapper;
  private final ArchivoAnualLogRepository logRepo;

  public ArchivoAnualService(
      @Value("${app.archivo-anual.enabled:false}") boolean enabled,
      @Value("${app.archivo-anual.dry-run:false}") boolean dryRun,
      @Value("${app.archivo-anual.path:./archivo-anual}") String path,
      JdbcTemplate jdbc,
      ObjectMapper mapper,
      ArchivoAnualLogRepository logRepo) {
    this.enabled = enabled;
    this.dryRun = dryRun;
    this.basePath = Path.of(path).toAbsolutePath().normalize();
    this.jdbc = jdbc;
    this.mapper = mapper;
    this.logRepo = logRepo;
  }

  public boolean isEnabled() {
    return enabled;
  }

  /**
   * Ejecuta el ciclo del año civil actual: archiva y limpia todo con fecha &lt; 1-ene de este año.
   *
   * @return resumen o null si no corrió (deshabilitado / ya ejecutado)
   */
  @Transactional
  public Map<String, Object> ejecutarSiCorresponde(String motivo) {
    if (!enabled) {
      log.debug("Archivo anual deshabilitado (app.archivo-anual.enabled=false)");
      return null;
    }
    LocalDate hoy = LocalDate.now(ZONA);
    int anio = hoy.getYear();
    // Solo en enero (cron 1-ene + reintento primeros días si el server estaba apagado).
    if (hoy.getMonthValue() != 1 || hoy.getDayOfMonth() > 7) {
      log.debug("Archivo anual: fuera de ventana enero 1–7 ({})", hoy);
      return null;
    }
    if (logRepo.existsById(anio)) {
      log.info("Archivo anual {}: ya ejecutado, se omite ({})", anio, motivo);
      return null;
    }

    LocalDate corte = LocalDate.of(anio, 1, 1);
    log.info(
        "Archivo anual {}: inicio ({}) corte={} dryRun={}", anio, motivo, corte, dryRun);

    Map<String, Object> resumen = new LinkedHashMap<>();
    resumen.put("anio", anio);
    resumen.put("corte", corte.toString());
    resumen.put("motivo", motivo);
    resumen.put("dryRun", dryRun);
    resumen.put("ejecutadoEn", Instant.now().toString());

    long totalBorradas = 0;
    Map<String, Object> porTenant = new LinkedHashMap<>();
    try {
      Files.createDirectories(basePath);
    } catch (IOException e) {
      throw new IllegalStateException("No se pudo crear " + basePath, e);
    }

    for (String tenant : TENANTS) {
      Map<String, Object> tRes = archivarYLimpiarTenant(tenant, corte, anio);
      porTenant.put(tenant, tRes);
      totalBorradas += ((Number) tRes.getOrDefault("filasBorradas", 0)).longValue();
    }
    resumen.put("tenants", porTenant);
    resumen.put("filasBorradas", totalBorradas);

    Path meta = basePath.resolve("resumen-" + anio + ".json");
    try {
      mapper.writerWithDefaultPrettyPrinter().writeValue(meta.toFile(), resumen);
    } catch (IOException e) {
      log.warn("No se pudo escribir resumen {}: {}", meta, e.getMessage());
    }

    if (!dryRun) {
      ArchivoAnualLog row = new ArchivoAnualLog();
      row.setAnio(anio);
      row.setEjecutadoEn(Instant.now());
      row.setFilasBorradas(totalBorradas);
      row.setRutaArchivo(meta.toString());
      row.setModo(motivo);
      logRepo.save(row);
    }

    log.info(
        "Archivo anual {}: fin. filasBorradas={} dryRun={} ruta={}",
        anio,
        totalBorradas,
        dryRun,
        meta);
    return resumen;
  }

  private Map<String, Object> archivarYLimpiarTenant(String tenant, LocalDate corte, int anio) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("tenant", tenant);
    Map<String, Integer> counts = new LinkedHashMap<>();
    Map<String, List<Map<String, Object>>> datos = new LinkedHashMap<>();

    // Tablas con columna FECHA directa.
    archiveTable(tenant, "VENTAS", "FECHA", corte, counts, datos);
    archiveTable(tenant, "ENTRADAS", "FECHA", corte, counts, datos);
    archiveTable(tenant, "MOVIMIENTOS_CAJA", "FECHA", corte, counts, datos);
    archiveTable(tenant, "APARTADOS", "FECHA", corte, counts, datos);
    archiveTable(tenant, "AJUSTES_INVENTARIO", "FECHA", corte, counts, datos);
    archiveTable(tenant, "PRODUCCIONES", "FECHA", corte, counts, datos);
    archiveTable(tenant, "TRASPASOS", "FECHA", corte, counts, datos);
    archivePedidosCerrados(tenant, corte, counts, datos);
    archivePreciosHistoricos(tenant, corte, counts, datos);

    Path archivo =
        basePath.resolve(
            "archivo-"
                + anio
                + "-"
                + tenant
                + "-"
                + DateTimeFormatter.BASIC_ISO_DATE.format(LocalDate.now(ZONA))
                + ".json");
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("tenant", tenant);
    payload.put("anioArchivadoHasta", anio - 1);
    payload.put("corteExclusivo", corte.toString());
    payload.put("conteos", counts);
    payload.put("tablas", datos);
    try {
      mapper.writerWithDefaultPrettyPrinter().writeValue(archivo.toFile(), payload);
      out.put("archivo", archivo.toString());
    } catch (IOException e) {
      throw new IllegalStateException("No se pudo escribir " + archivo, e);
    }

    long borradas = 0;
    if (!dryRun) {
      borradas = purgarTenant(tenant, corte);
    } else {
      borradas = counts.values().stream().mapToInt(Integer::intValue).sum();
      out.put("nota", "dry-run: no se borró nada");
    }
    out.put("conteosArchivados", counts);
    out.put("filasBorradas", borradas);
    return out;
  }

  private void archiveTable(
      String tenant,
      String table,
      String fechaCol,
      LocalDate corte,
      Map<String, Integer> counts,
      Map<String, List<Map<String, Object>>> datos) {
    String sql =
        "SELECT * FROM "
            + table
            + " WHERE TENANT_ID = ? AND "
            + fechaCol
            + " < ? ORDER BY "
            + fechaCol
            + ", ID";
    List<Map<String, Object>> rows = jdbc.queryForList(sql, tenant, java.sql.Date.valueOf(corte));
    counts.put(table, rows.size());
    if (!rows.isEmpty()) {
      datos.put(table, rows);
    }
    // Insumos de producciones a archivar
    if ("PRODUCCIONES".equals(table) && !rows.isEmpty()) {
      List<Map<String, Object>> insumos =
          jdbc.queryForList(
              """
              SELECT i.* FROM PRODUCCION_INSUMOS i
              WHERE i.PRODUCCION_ID IN (
                SELECT ID FROM PRODUCCIONES WHERE TENANT_ID = ? AND FECHA < ?
              )
              """,
              tenant,
              java.sql.Date.valueOf(corte));
      counts.put("PRODUCCION_INSUMOS", insumos.size());
      if (!insumos.isEmpty()) {
        datos.put("PRODUCCION_INSUMOS", insumos);
      }
    }
    if ("TRASPASOS".equals(table) && !rows.isEmpty()) {
      List<Map<String, Object>> lineas =
          jdbc.queryForList(
              """
              SELECT l.* FROM TRASPASO_LINEAS l
              WHERE l.TRASPASO_ID IN (
                SELECT ID FROM TRASPASOS WHERE TENANT_ID = ? AND FECHA < ?
              )
              """,
              tenant,
              java.sql.Date.valueOf(corte));
      counts.put("TRASPASO_LINEAS", lineas.size());
      if (!lineas.isEmpty()) {
        datos.put("TRASPASO_LINEAS", lineas);
      }
    }
    if ("TRASPASOS".equals(table)) {
      // Abonos van por persona/fecha, no por traspaso_id.
      List<Map<String, Object>> abonos =
          jdbc.queryForList(
              "SELECT * FROM TRASPASO_ABONOS WHERE TENANT_ID = ? AND FECHA < ? ORDER BY FECHA, ID",
              tenant,
              java.sql.Date.valueOf(corte));
      counts.put("TRASPASO_ABONOS", abonos.size());
      if (!abonos.isEmpty()) {
        datos.put("TRASPASO_ABONOS", abonos);
      }
    }
  }

  private void archivePedidosCerrados(
      String tenant,
      LocalDate corte,
      Map<String, Integer> counts,
      Map<String, List<Map<String, Object>>> datos) {
    List<Map<String, Object>> pedidos =
        jdbc.queryForList(
            """
            SELECT * FROM PEDIDOS
            WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'
            ORDER BY FECHA, ID
            """,
            tenant,
            java.sql.Date.valueOf(corte));
    counts.put("PEDIDOS", pedidos.size());
    if (pedidos.isEmpty()) {
      counts.put("PEDIDO_ITEMS", 0);
      counts.put("PEDIDO_ABONOS", 0);
      return;
    }
    datos.put("PEDIDOS", pedidos);
    List<Map<String, Object>> items =
        jdbc.queryForList(
            """
            SELECT i.* FROM PEDIDO_ITEMS i
            WHERE i.PEDIDO_ID IN (
              SELECT ID FROM PEDIDOS WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'
            )
            """,
            tenant,
            java.sql.Date.valueOf(corte));
    counts.put("PEDIDO_ITEMS", items.size());
    if (!items.isEmpty()) {
      datos.put("PEDIDO_ITEMS", items);
    }
    List<Map<String, Object>> abonos =
        jdbc.queryForList(
            """
            SELECT a.* FROM PEDIDO_ABONOS a
            WHERE a.PEDIDO_ID IN (
              SELECT ID FROM PEDIDOS WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'
            )
            """,
            tenant,
            java.sql.Date.valueOf(corte));
    counts.put("PEDIDO_ABONOS", abonos.size());
    if (!abonos.isEmpty()) {
      datos.put("PEDIDO_ABONOS", abonos);
    }
  }

  private void archivePreciosHistoricos(
      String tenant,
      LocalDate corte,
      Map<String, Integer> counts,
      Map<String, List<Map<String, Object>>> datos) {
    // Solo los que tienen al menos otro precio vigente >= corte (no dejar producto sin historial).
    List<Map<String, Object>> rows =
        jdbc.queryForList(
            """
            SELECT ph.* FROM PRECIOS_HISTORICOS ph
            WHERE ph.TENANT_ID = ?
              AND ph.FECHA_VIGENCIA < ?
              AND EXISTS (
                SELECT 1 FROM PRECIOS_HISTORICOS ph2
                WHERE ph2.PRODUCTO_ID = ph.PRODUCTO_ID
                  AND ph2.TENANT_ID = ph.TENANT_ID
                  AND ph2.FECHA_VIGENCIA >= ?
              )
            ORDER BY ph.PRODUCTO_ID, ph.FECHA_VIGENCIA
            """,
            tenant,
            java.sql.Date.valueOf(corte),
            java.sql.Date.valueOf(corte));
    counts.put("PRECIOS_HISTORICOS", rows.size());
    if (!rows.isEmpty()) {
      datos.put("PRECIOS_HISTORICOS", rows);
    }
  }

  private long purgarTenant(String tenant, LocalDate corte) {
    java.sql.Date d = java.sql.Date.valueOf(corte);
    long n = 0;
    n +=
        jdbc.update(
            """
            DELETE FROM PEDIDO_ABONOS WHERE PEDIDO_ID IN (
              SELECT ID FROM PEDIDOS WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'
            )
            """,
            tenant,
            d);
    n +=
        jdbc.update(
            """
            DELETE FROM PEDIDO_ITEMS WHERE PEDIDO_ID IN (
              SELECT ID FROM PEDIDOS WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'
            )
            """,
            tenant,
            d);
    n +=
        jdbc.update(
            "DELETE FROM PEDIDOS WHERE TENANT_ID = ? AND FECHA < ? AND ESTADO = 'CERRADO'",
            tenant,
            d);

    n +=
        jdbc.update(
            """
            DELETE FROM TRASPASO_LINEAS WHERE TRASPASO_ID IN (
              SELECT ID FROM TRASPASOS WHERE TENANT_ID = ? AND FECHA < ?
            )
            """,
            tenant,
            d);
    n += jdbc.update("DELETE FROM TRASPASOS WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);
    n += jdbc.update("DELETE FROM TRASPASO_ABONOS WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);

    n +=
        jdbc.update(
            """
            DELETE FROM PRODUCCION_INSUMOS WHERE PRODUCCION_ID IN (
              SELECT ID FROM PRODUCCIONES WHERE TENANT_ID = ? AND FECHA < ?
            )
            """,
            tenant,
            d);
    n += jdbc.update("DELETE FROM PRODUCCIONES WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);

    n += jdbc.update("DELETE FROM AJUSTES_INVENTARIO WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);
    n += jdbc.update("DELETE FROM APARTADOS WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);
    n += jdbc.update("DELETE FROM MOVIMIENTOS_CAJA WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);
    n += jdbc.update("DELETE FROM VENTAS WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);
    n += jdbc.update("DELETE FROM ENTRADAS WHERE TENANT_ID = ? AND FECHA < ?", tenant, d);

    n +=
        jdbc.update(
            """
            DELETE FROM PRECIOS_HISTORICOS
            WHERE TENANT_ID = ?
              AND FECHA_VIGENCIA < ?
              AND EXISTS (
                SELECT 1 FROM PRECIOS_HISTORICOS ph2
                WHERE ph2.PRODUCTO_ID = PRECIOS_HISTORICOS.PRODUCTO_ID
                  AND ph2.TENANT_ID = PRECIOS_HISTORICOS.TENANT_ID
                  AND ph2.FECHA_VIGENCIA >= ?
              )
            """,
            tenant,
            d,
            d);

    // Cortes, productos, personas, caja_config, inversión, pedidos abiertos: se conservan.
    return n;
  }
}
