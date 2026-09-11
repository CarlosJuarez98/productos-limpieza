package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.*;
import com.productoslimpieza.repo.*;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
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
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Semilla única del tenant admin desde cloud_dump.json (datos reales ATP).
 * Flag: app.import-admin-cloud=true. Solo si admin no tiene productos.
 */
@Component
@Order(1)
public class AdminDataSeedRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(AdminDataSeedRunner.class);
  private static final String TENANT = "admin";

  private final boolean enabled;
  private final String dumpPath;
  private final ObjectMapper mapper;
  private final ProductoRepository productoRepo;
  private final PersonaRepository personaRepo;
  private final PrecioHistoricoRepository precioRepo;
  private final VentaRepository ventaRepo;
  private final EntradaRepository entradaRepo;
  private final CajaConfigRepository cajaConfigRepo;
  private final MargenConfigRepository margenConfigRepo;
  private final MovimientoCajaRepository movimientoRepo;
  private final ApartadoRepository apartadoRepo;
  private final InversionRepository inversionRepo;
  private final TraspasoRepository traspasoRepo;
  private final TraspasoLineaRepository traspasoLineaRepo;
  private final TraspasoAbonoRepository traspasoAbonoRepo;
  private final ProduccionRepository produccionRepo;
  private final CorteCajaRepository corteRepo;

  @PersistenceContext
  private EntityManager entityManager;

  public AdminDataSeedRunner(
      @Value("${app.import-admin-cloud:false}") boolean enabled,
      @Value("${app.import-admin-cloud-path:}") String dumpPath,
      ObjectMapper mapper,
      ProductoRepository productoRepo,
      PersonaRepository personaRepo,
      PrecioHistoricoRepository precioRepo,
      VentaRepository ventaRepo,
      EntradaRepository entradaRepo,
      CajaConfigRepository cajaConfigRepo,
      MargenConfigRepository margenConfigRepo,
      MovimientoCajaRepository movimientoRepo,
      ApartadoRepository apartadoRepo,
      InversionRepository inversionRepo,
      TraspasoRepository traspasoRepo,
      TraspasoLineaRepository traspasoLineaRepo,
      TraspasoAbonoRepository traspasoAbonoRepo,
      ProduccionRepository produccionRepo,
      CorteCajaRepository corteRepo) {
    this.enabled = enabled;
    this.dumpPath = dumpPath;
    this.mapper = mapper;
    this.productoRepo = productoRepo;
    this.personaRepo = personaRepo;
    this.precioRepo = precioRepo;
    this.ventaRepo = ventaRepo;
    this.entradaRepo = entradaRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.margenConfigRepo = margenConfigRepo;
    this.movimientoRepo = movimientoRepo;
    this.apartadoRepo = apartadoRepo;
    this.inversionRepo = inversionRepo;
    this.traspasoRepo = traspasoRepo;
    this.traspasoLineaRepo = traspasoLineaRepo;
    this.traspasoAbonoRepo = traspasoAbonoRepo;
    this.produccionRepo = produccionRepo;
    this.corteRepo = corteRepo;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) throws Exception {
    if (!enabled) return;
    if (productoRepo.countByTenantId(TENANT) > 0) {
      log.info("Admin ya tiene {} productos; no se importa cloud dump", productoRepo.countByTenantId(TENANT));
      return;
    }
    Map<String, Object> dump = loadDump();
    if (dump == null) {
      log.error("No se encontró cloud_dump.json; admin no importado");
      return;
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> tables = (Map<String, Object>) dump.get("tables");
    if (tables == null || tables.isEmpty()) {
      log.error("cloud_dump sin tables");
      return;
    }
    log.warn("IMPORT ADMIN CLOUD: importando dump → tenant={}", TENANT);
    TenantContext.set(TENANT);
    try {
      enableTenantFilter();
      importAll(tables);
      log.warn(
          "IMPORT ADMIN OK: productos={} ventas={} entradas={}",
          productoRepo.countByTenantId(TENANT),
          ventaRepo.count(),
          entradaRepo.count());
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

  private Map<String, Object> loadDump() throws Exception {
    Path configured = dumpPath != null && !dumpPath.isBlank() ? Path.of(dumpPath) : null;
    Path local = Path.of("A:/Programas-java/Negocios/productos-limpieza/_migrate/cloud_dump.json");
    Path cwd = Path.of("_migrate/cloud_dump.json");
    Path[] candidates = configured != null
        ? new Path[] {configured, local, cwd}
        : new Path[] {local, cwd};
    for (Path p : candidates) {
      if (p != null && Files.isRegularFile(p)) {
        log.info("Leyendo cloud dump: {}", p.toAbsolutePath());
        try (InputStream in = Files.newInputStream(p)) {
          return mapper.readValue(in, new TypeReference<>() {});
        }
      }
    }
    ClassPathResource cp = new ClassPathResource("data-admin/cloud_dump.json");
    if (cp.exists()) {
      log.info("Leyendo cloud dump classpath data-admin/cloud_dump.json");
      try (InputStream in = cp.getInputStream()) {
        return mapper.readValue(in, new TypeReference<>() {});
      }
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private void importAll(Map<String, Object> tables) {
    Map<Long, Producto> productos = new HashMap<>();
    Map<Long, Persona> personas = new HashMap<>();
    Map<Long, Traspaso> traspasos = new HashMap<>();

    for (Map<String, Object> row : rows(tables, "PRODUCTOS")) {
      Producto p = new Producto();
      p.setTenantId(TENANT);
      p.setNombre(str(row.get("NOMBRE")));
      p.setActivo(bool(row.get("ACTIVO"), true));
      p.setCantidadInicial(nz(dec(row.get("CANTIDAD_INICIAL"))));
      p.setPrecioCompra(nz(dec(row.get("PRECIO_COMPRA"))));
      p.setPrecioMayoreo5(dec(row.get("PRECIO_MAYOREO5")));
      p.setPrecioMayoreo10(dec(row.get("PRECIO_MAYOREO10")));
      p.setVendePor(UnidadVenta.fromRaw(str(row.get("VENDE_POR"))));
      p = productoRepo.save(p);
      productos.put(longId(row.get("ID")), p);
    }

    for (Map<String, Object> row : rows(tables, "PERSONAS")) {
      Persona pe = new Persona();
      pe.setTenantId(TENANT);
      pe.setNombre(str(row.get("NOMBRE")));
      pe = personaRepo.save(pe);
      personas.put(longId(row.get("ID")), pe);
    }

    for (Map<String, Object> row : rows(tables, "CAJA_CONFIG")) {
      CajaConfig cfg = cajaConfigRepo.findByTenantId(TENANT).orElseGet(CajaConfig::new);
      cfg.setTenantId(TENANT);
      if (cfg.getId() == null) {
        cfg.setId(cajaConfigRepo.nextId());
      }
      cfg.setFechaInicio(date(row.get("FECHA_INICIO")));
      cfg.setFechaFin(date(row.get("FECHA_FIN")));
      cfg.setFondoInicial(nz(dec(row.get("FONDO_INICIAL"))));
      cajaConfigRepo.save(cfg);
    }

    for (Map<String, Object> row : rows(tables, "MARGEN_CONFIG")) {
      MargenConfig m = margenConfigRepo.findByTenantId(TENANT).orElseGet(MargenConfig::new);
      m.setTenantId(TENANT);
      if (m.getId() == null) {
        m.setId(margenConfigRepo.nextId());
      }
      if (row.get("MARGEN_MIN") != null) m.setMargenMin(nz(dec(row.get("MARGEN_MIN"))));
      if (row.get("MARGEN_MAX") != null) m.setMargenMax(nz(dec(row.get("MARGEN_MAX"))));
      if (row.get("MARGEN_MAYOREO5") != null) m.setMargenMayoreo5(dec(row.get("MARGEN_MAYOREO5")));
      if (row.get("MARGEN_MAYOREO10") != null) m.setMargenMayoreo10(dec(row.get("MARGEN_MAYOREO10")));
      margenConfigRepo.save(m);
    }

    for (Map<String, Object> row : rows(tables, "PRECIOS_HISTORICOS")) {
      Producto p = productos.get(longId(row.get("PRODUCTO_ID")));
      if (p == null) continue;
      PrecioHistorico ph = new PrecioHistorico();
      ph.setTenantId(TENANT);
      ph.setProducto(p);
      ph.setFechaVigencia(date(row.get("FECHA_VIGENCIA")));
      ph.setPrecio(nz(dec(row.get("PRECIO"))));
      precioRepo.save(ph);
    }

    for (Map<String, Object> row : rows(tables, "VENTAS")) {
      Venta v = new Venta();
      v.setTenantId(TENANT);
      v.setFecha(date(row.get("FECHA")));
      v.setTipoVenta(TipoVenta.valueOf(str(row.get("TIPO_VENTA"))));
      v.setCantidad(nz(dec(row.get("CANTIDAD"))));
      v.setTotal(nz(dec(row.get("TOTAL"))));
      Long pid = longId(row.get("PRODUCTO_ID"));
      if (pid != null) v.setProducto(productos.get(pid));
      ventaRepo.save(v);
    }

    for (Map<String, Object> row : rows(tables, "ENTRADAS")) {
      Producto p = productos.get(longId(row.get("PRODUCTO_ID")));
      if (p == null) continue;
      Entrada e = new Entrada();
      e.setTenantId(TENANT);
      e.setFecha(date(row.get("FECHA")));
      e.setProducto(p);
      e.setCantidad(nz(dec(row.get("CANTIDAD"))));
      e.setPrecioProveedor(dec(row.get("PRECIO_PROVEEDOR")));
      e.setTotal(dec(row.get("TOTAL")));
      entradaRepo.save(e);
    }

    for (Map<String, Object> row : rows(tables, "MOVIMIENTOS_CAJA")) {
      MovimientoCaja m = new MovimientoCaja();
      m.setTenantId(TENANT);
      m.setFecha(date(row.get("FECHA")));
      m.setTipo(TipoMovimientoCaja.valueOf(str(row.get("TIPO"))));
      m.setMonto(nz(dec(row.get("MONTO"))));
      m.setMotivo(str(row.get("MOTIVO")));
      movimientoRepo.save(m);
    }

    for (Map<String, Object> row : rows(tables, "APARTADOS")) {
      Apartado a = new Apartado();
      a.setTenantId(TENANT);
      a.setFecha(date(row.get("FECHA")));
      a.setCategoria(CategoriaApartado.valueOf(str(row.get("CATEGORIA"))));
      a.setIngreso(nz(dec(row.get("INGRESO"))));
      String tipo = str(row.get("TIPO"));
      a.setTipo(tipo == null || tipo.isBlank()
          ? TipoMovimientoApartado.INGRESO
          : TipoMovimientoApartado.valueOf(tipo));
      a.setMotivo(str(row.get("MOTIVO")));
      apartadoRepo.save(a);
    }

    for (Map<String, Object> row : rows(tables, "INVERSION_ITEMS")) {
      InversionItem item = new InversionItem();
      item.setTenantId(TENANT);
      item.setTipo(str(row.get("TIPO")));
      item.setConcepto(str(row.get("CONCEPTO")));
      item.setCantidad(dec(row.get("CANTIDAD")));
      item.setPrecioUnidad(dec(row.get("PRECIO_UNIDAD")));
      item.setMonto(dec(row.get("MONTO")));
      inversionRepo.save(item);
    }

    for (Map<String, Object> row : rows(tables, "TRASPASOS")) {
      Traspaso t = new Traspaso();
      t.setTenantId(TENANT);
      t.setFecha(date(row.get("FECHA")));
      t.setNota(str(row.get("NOTA")));
      t.setTotal(nz(dec(row.get("TOTAL"))));
      t.setPersonaNombre(str(row.get("PERSONA")));
      Long personaId = longId(row.get("PERSONA_ID"));
      if (personaId != null) t.setPersona(personas.get(personaId));
      Long prodId = longId(row.get("PRODUCTO_ID"));
      if (prodId != null) t.setProductoLegado(productos.get(prodId));
      t.setCantidadLegado(dec(row.get("CANTIDAD")));
      t.setPrecioCompraLegado(dec(row.get("PRECIO_COMPRA")));
      t = traspasoRepo.save(t);
      traspasos.put(longId(row.get("ID")), t);
    }

    for (Map<String, Object> row : rows(tables, "TRASPASO_LINEAS")) {
      Traspaso t = traspasos.get(longId(row.get("TRASPASO_ID")));
      Producto p = productos.get(longId(row.get("PRODUCTO_ID")));
      if (t == null || p == null) continue;
      TraspasoLinea linea = new TraspasoLinea();
      linea.setTenantId(TENANT);
      linea.setTraspaso(t);
      linea.setProducto(p);
      linea.setCantidad(nz(dec(row.get("CANTIDAD"))));
      linea.setPrecioCompra(nz(dec(row.get("PRECIO_COMPRA"))));
      linea.setTotal(nz(dec(row.get("TOTAL"))));
      traspasoLineaRepo.save(linea);
    }

    for (Map<String, Object> row : rows(tables, "TRASPASO_ABONOS")) {
      TraspasoAbono a = new TraspasoAbono();
      a.setTenantId(TENANT);
      a.setFecha(date(row.get("FECHA")));
      a.setMonto(nz(dec(row.get("MONTO"))));
      a.setNota(str(row.get("NOTA")));
      a.setPersonaNombre(str(row.get("PERSONA")));
      Long personaId = longId(row.get("PERSONA_ID"));
      if (personaId != null) a.setPersona(personas.get(personaId));
      traspasoAbonoRepo.save(a);
    }

    for (Map<String, Object> row : rows(tables, "PRODUCCIONES")) {
      Producto insumo = productos.get(longId(row.get("PRODUCTO_INSUMO_ID")));
      Producto resultado = productos.get(longId(row.get("PRODUCTO_RESULTADO_ID")));
      if (insumo == null || resultado == null) continue;
      Produccion pr = new Produccion();
      pr.setTenantId(TENANT);
      pr.setFecha(date(row.get("FECHA")));
      pr.setProductoInsumo(insumo);
      pr.setProductoResultado(resultado);
      pr.setCantidadInsumo(nz(dec(row.get("CANTIDAD_INSUMO"))));
      pr.setCantidadResultado(nz(dec(row.get("CANTIDAD_RESULTADO"))));
      produccionRepo.save(pr);
    }

    for (Map<String, Object> row : rows(tables, "CORTES_CAJA")) {
      CorteCaja c = new CorteCaja();
      c.setTenantId(TENANT);
      c.setFecha(date(row.get("FECHA")));
      c.setFondoPeriodo(dec(row.get("FONDO_PERIODO")));
      c.setParaApartar(dec(row.get("PARA_APARTAR")));
      c.setTotalCaja(dec(row.get("TOTAL_CAJA")));
      c.setTotalCalculadora(dec(row.get("TOTAL_CALCULADORA")));
      c.setTotalNegocio(dec(row.get("TOTAL_NEGOCIO")));
      corteRepo.save(c);
    }

    entityManager.flush();
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> rows(Map<String, Object> tables, String name) {
    Object meta = tables.get(name);
    if (!(meta instanceof Map<?, ?> m)) return List.of();
    Object rows = m.get("rows");
    if (!(rows instanceof List<?> list)) return List.of();
    return (List<Map<String, Object>>) rows;
  }

  private static String str(Object o) {
    return o == null ? null : String.valueOf(o).trim();
  }

  private static Long longId(Object o) {
    if (o == null) return null;
    if (o instanceof Number n) return n.longValue();
    String s = String.valueOf(o).trim();
    if (s.isEmpty() || s.equalsIgnoreCase("null")) return null;
    return Long.parseLong(s);
  }

  private static boolean bool(Object o, boolean def) {
    if (o == null) return def;
    if (o instanceof Boolean b) return b;
    if (o instanceof Number n) return n.intValue() != 0;
    String s = String.valueOf(o).trim();
    return "1".equals(s) || "true".equalsIgnoreCase(s) || "Y".equalsIgnoreCase(s);
  }

  private static BigDecimal dec(Object o) {
    if (o == null) return null;
    if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
    String s = String.valueOf(o).trim();
    if (s.isEmpty() || s.equals("-") || s.equalsIgnoreCase("null")) return null;
    return new BigDecimal(s);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static LocalDate date(Object o) {
    if (o == null) return null;
    if (o instanceof LocalDate d) return d;
    if (o instanceof LocalDateTime dt) return dt.toLocalDate();
    String s = String.valueOf(o).trim();
    if (s.length() >= 10 && s.charAt(4) == '-') {
      return LocalDate.parse(s.substring(0, 10));
    }
    return LocalDate.parse(s);
  }
}
