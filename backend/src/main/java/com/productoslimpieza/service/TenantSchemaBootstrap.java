package com.productoslimpieza.service;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Asegura columna TENANT_ID, rellena nulls como mama, y quita unique global en nombre
 * (pasa a unique por tenant vía entidades).
 */
@Component
@Order(-10)
public class TenantSchemaBootstrap implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(TenantSchemaBootstrap.class);

  private static final List<String> TENANT_TABLES = List.of(
      "PRODUCTOS",
      "PERSONAS",
      "PRECIOS_HISTORICOS",
      "VENTAS",
      "ENTRADAS",
      "CAJA_CONFIG",
      "MARGEN_CONFIG",
      "MOVIMIENTOS_CAJA",
      "APARTADOS",
      "INVERSION_ITEMS",
      "TRASPASOS",
      "TRASPASO_LINEAS",
      "TRASPASO_ABONOS",
      "PRODUCCIONES",
      "CORTES_CAJA",
      "AJUSTES_INVENTARIO",
      "PEDIDOS",
      "PEDIDO_ITEMS"
  );

  private final JdbcTemplate jdbc;

  public TenantSchemaBootstrap(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(ApplicationArguments args) {
    log.info("TenantSchemaBootstrap: iniciando");
    for (String table : TENANT_TABLES) {
      ensureTenantColumn(table);
      backfillMama(table);
    }
    dropNombreOnlyUnique("PRODUCTOS");
    dropNombreOnlyUnique("PERSONAS");
    dropFechaOnlyUnique("CORTES_CAJA");
    ensureCorteTenantFechaUnique();
    log.info("TenantSchemaBootstrap: listo");
  }

  private boolean tableExists(String table) {
    Integer n = jdbc.queryForObject(
        """
        SELECT COUNT(*) FROM user_tables WHERE table_name = ?
        """,
        Integer.class,
        table.toUpperCase());
    return n != null && n > 0;
  }

  private boolean columnExists(String table, String column) {
    Integer n = jdbc.queryForObject(
        """
        SELECT COUNT(*) FROM user_tab_columns
        WHERE table_name = ? AND column_name = ?
        """,
        Integer.class,
        table.toUpperCase(),
        column.toUpperCase());
    return n != null && n > 0;
  }

  private void ensureTenantColumn(String table) {
    if (!tableExists(table)) {
      log.debug("Tabla {} no existe aún (ddl-auto la creará)", table);
      return;
    }
    if (columnExists(table, "TENANT_ID")) {
      return;
    }
    try {
      jdbc.execute("ALTER TABLE " + table + " ADD TENANT_ID VARCHAR2(32)");
      log.info("Añadida columna TENANT_ID a {}", table);
    } catch (Exception e) {
      log.warn("No se pudo añadir TENANT_ID a {}: {}", table, e.getMessage());
    }
  }

  private void backfillMama(String table) {
    if (!tableExists(table) || !columnExists(table, "TENANT_ID")) {
      return;
    }
    try {
      int n = jdbc.update(
          "UPDATE " + table + " SET TENANT_ID = 'mama' WHERE TENANT_ID IS NULL");
      if (n > 0) {
        log.info("Backfill tenant=mama en {}: {} filas", table, n);
      }
    } catch (Exception e) {
      log.warn("Backfill mama falló en {}: {}", table, e.getMessage());
    }
  }

  /**
   * Quita UNIQUE que solo cubre NOMBRE (sin TENANT_ID), para permitir mismo nombre en mama/admin.
   */
  private void dropNombreOnlyUnique(String table) {
    if (!tableExists(table)) return;
    try {
      List<String> candidates = jdbc.query(
          """
          SELECT c.constraint_name
          FROM user_constraints c
          WHERE c.table_name = ?
            AND c.constraint_type = 'U'
            AND (
              SELECT COUNT(*) FROM user_cons_columns cc
              WHERE cc.constraint_name = c.constraint_name AND cc.owner = c.owner
            ) = 1
            AND EXISTS (
              SELECT 1 FROM user_cons_columns cc
              WHERE cc.constraint_name = c.constraint_name
                AND cc.owner = c.owner
                AND cc.column_name = 'NOMBRE'
            )
          """,
          (rs, i) -> rs.getString(1),
          table.toUpperCase());
      for (String name : candidates) {
        try {
          jdbc.execute("ALTER TABLE " + table + " DROP CONSTRAINT " + name);
          log.info("Eliminado unique solo-NOMBRE {} en {}", name, table);
        } catch (Exception e) {
          log.warn("No se pudo dropear {}: {}", name, e.getMessage());
        }
      }
    } catch (Exception e) {
      log.debug("Consulta unique {} omitida: {}", table, e.getMessage());
    }
  }

  /**
   * Quita UNIQUE que solo cubre FECHA (sin TENANT_ID), p.ej. UK_CORTE_FECHA.
   */
  private void dropFechaOnlyUnique(String table) {
    if (!tableExists(table)) return;
    try {
      List<String> candidates = jdbc.query(
          """
          SELECT c.constraint_name
          FROM user_constraints c
          WHERE c.table_name = ?
            AND c.constraint_type = 'U'
            AND (
              SELECT COUNT(*) FROM user_cons_columns cc
              WHERE cc.constraint_name = c.constraint_name AND cc.owner = c.owner
            ) = 1
            AND EXISTS (
              SELECT 1 FROM user_cons_columns cc
              WHERE cc.constraint_name = c.constraint_name
                AND cc.owner = c.owner
                AND cc.column_name = 'FECHA'
            )
          """,
          (rs, i) -> rs.getString(1),
          table.toUpperCase());
      for (String name : candidates) {
        try {
          jdbc.execute("ALTER TABLE " + table + " DROP CONSTRAINT " + name);
          log.info("Eliminado unique solo-FECHA {} en {}", name, table);
        } catch (Exception e) {
          log.warn("No se pudo dropear {}: {}", name, e.getMessage());
        }
      }
    } catch (Exception e) {
      log.debug("Consulta unique fecha {} omitida: {}", table, e.getMessage());
    }
  }

  private void ensureCorteTenantFechaUnique() {
    if (!tableExists("CORTES_CAJA") || !columnExists("CORTES_CAJA", "TENANT_ID")) return;
    try {
      Integer n = jdbc.queryForObject(
          """
          SELECT COUNT(*) FROM user_constraints c
          WHERE c.table_name = 'CORTES_CAJA'
            AND c.constraint_type = 'U'
            AND c.constraint_name = 'UK_CORTE_TENANT_FECHA'
          """,
          Integer.class);
      if (n != null && n > 0) return;
      jdbc.execute(
          "ALTER TABLE CORTES_CAJA ADD CONSTRAINT UK_CORTE_TENANT_FECHA UNIQUE (TENANT_ID, FECHA)");
      log.info("Creado UK_CORTE_TENANT_FECHA en CORTES_CAJA");
    } catch (Exception e) {
      log.warn("No se pudo crear UK_CORTE_TENANT_FECHA: {}", e.getMessage());
    }
  }
}
