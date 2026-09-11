package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.AjusteInventario;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.AjusteInventarioRepository;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Carga forzada de datos Mama (Excel → data-mama/). Solo local: app.import-mama-replace=true.
 * Solo borra filas tenant=mama; no toca admin.
 */
@Component
@Order(0)
public class MamaDataReplaceRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(MamaDataReplaceRunner.class);
  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
  private static final String TENANT = "mama";

  /** Orden hijos → padres para respetar FKs. */
  private static final List<String> WIPE_TABLES = List.of(
      "AJUSTES_INVENTARIO",
      "PEDIDO_ITEMS",
      "ENTRADAS",
      "PEDIDOS",
      "TRASPASO_ABONOS",
      "TRASPASO_LINEAS",
      "TRASPASOS",
      "PRODUCCIONES",
      "VENTAS",
      "PRECIOS_HISTORICOS",
      "MOVIMIENTOS_CAJA",
      "APARTADOS",
      "INVERSION_ITEMS",
      "CORTES_CAJA",
      "CAJA_CONFIG",
      "MARGEN_CONFIG",
      "APARTADO_RUBROS",
      "PRODUCTOS",
      "PERSONAS"
  );

  private final boolean enabled;
  private final ObjectMapper mapper;
  private final DataImportRunner dataImportRunner;
  private final InventarioService inventarioService;
  private final ProductoRepository productoRepo;
  private final VentaRepository ventaRepo;
  private final EntradaRepository entradaRepo;
  private final AjusteInventarioRepository ajusteRepo;
  private final JdbcTemplate jdbc;

  @PersistenceContext
  private EntityManager entityManager;

  public MamaDataReplaceRunner(
      @Value("${app.import-mama-replace:false}") boolean enabled,
      ObjectMapper mapper,
      DataImportRunner dataImportRunner,
      InventarioService inventarioService,
      ProductoRepository productoRepo,
      VentaRepository ventaRepo,
      EntradaRepository entradaRepo,
      AjusteInventarioRepository ajusteRepo,
      JdbcTemplate jdbc) {
    this.enabled = enabled;
    this.mapper = mapper;
    this.dataImportRunner = dataImportRunner;
    this.inventarioService = inventarioService;
    this.productoRepo = productoRepo;
    this.ventaRepo = ventaRepo;
    this.entradaRepo = entradaRepo;
    this.ajusteRepo = ajusteRepo;
    this.jdbc = jdbc;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) throws Exception {
    if (!enabled) return;
    log.warn("IMPORT MAMA REPLACE: borrando solo tenant={} e importando data-mama/", TENANT);
    wipeMamaOnly();
    TenantContext.set(TENANT);
    try {
      enableTenantFilter();
      dataImportRunner.importFromClasspath("data-mama/");
      int ajustes = cuadreStockDesdeExcel();
      log.warn(
          "IMPORT MAMA OK (tenant={}): productos={} ventas={} entradas={} ajustesCuadre={}",
          TENANT,
          productoRepo.countByTenantId(TENANT),
          ventaRepo.count(),
          entradaRepo.count(),
          ajustes);
    } finally {
      TenantContext.clear();
    }
  }

  private void enableTenantFilter() {
    Session session = entityManager.unwrap(Session.class);
    var filter = session.getEnabledFilter(TenantEntity.FILTER);
    if (filter == null) {
      session.enableFilter(TenantEntity.FILTER).setParameter("tenantId", TENANT);
    } else {
      filter.setParameter("tenantId", TENANT);
    }
  }

  private void wipeMamaOnly() {
    for (String table : WIPE_TABLES) {
      try {
        Integer n = jdbc.update("DELETE FROM " + table + " WHERE tenant_id = ?", TENANT);
        log.info("Wipe mama {}: {} filas", table, n);
      } catch (Exception e) {
        // Tabla sin TENANT_ID aún o inexistente: intentar delete por nombre legacy
        try {
          Integer n = jdbc.update("DELETE FROM " + table + " WHERE TENANT_ID = ?", TENANT);
          log.info("Wipe mama {}: {} filas", table, n);
        } catch (Exception e2) {
          log.debug("Wipe mama omitido {}: {}", table, e2.getMessage());
        }
      }
    }
  }

  private int cuadreStockDesdeExcel() throws IOException {
    ClassPathResource res = new ClassPathResource("data-mama/stock-esperado.json");
    if (!res.exists()) return 0;
    List<Map<String, Object>> esperado =
        mapper.readValue(res.getInputStream().readAllBytes(), new TypeReference<>() {});
    LocalDate hoy = LocalDate.now(ZONA);
    int n = 0;
    for (Map<String, Object> row : esperado) {
      String nombre = String.valueOf(row.get("producto")).trim();
      if (nombre.isEmpty()) continue;
      Producto p = productoRepo
          .findByNombreIgnoreCaseAndTenantId(nombre, TENANT)
          .or(() -> productoRepo.findByNombreIgnoreCase(nombre))
          .orElse(null);
      if (p == null) continue;
      BigDecimal want = toBd(row.get("stock"));
      BigDecimal have = inventarioService.stockActual(p);
      BigDecimal delta = want.subtract(have).setScale(4, RoundingMode.HALF_UP);
      if (delta.abs().compareTo(new BigDecimal("0.005")) < 0) continue;
      AjusteInventario a = new AjusteInventario();
      a.setFecha(hoy);
      a.setProducto(p);
      a.setCantidad(delta);
      a.setMotivo("Cuadre carga Excel Mama");
      a.setTenantId(TENANT);
      ajusteRepo.save(a);
      n++;
    }
    return n;
  }

  private static BigDecimal toBd(Object o) {
    if (o == null) return BigDecimal.ZERO;
    if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
    return new BigDecimal(String.valueOf(o).trim());
  }
}
