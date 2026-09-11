package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.*;
import com.productoslimpieza.repo.*;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Semilla opcional desde classpath (resources/data) SOLO si app.import-on-startup=true
 * y la BD está vacía. En operación normal no corre: la fuente de verdad es Oracle.
 */
@Component
@org.springframework.core.annotation.Order(1)
public class DataImportRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataImportRunner.class);

  private final ObjectMapper mapper;
  private final ProductoRepository productoRepo;
  private final PrecioHistoricoRepository precioRepo;
  private final VentaRepository ventaRepo;
  private final EntradaRepository entradaRepo;
  private final CajaConfigRepository cajaConfigRepo;
  private final MovimientoCajaRepository movimientoRepo;
  private final ApartadoRepository apartadoRepo;
  private final InversionRepository inversionRepo;
  private final CorteCajaRepository corteRepo;
  private final boolean importOnStartup;

  @PersistenceContext
  private EntityManager entityManager;

  public DataImportRunner(
      ObjectMapper mapper,
      ProductoRepository productoRepo,
      PrecioHistoricoRepository precioRepo,
      VentaRepository ventaRepo,
      EntradaRepository entradaRepo,
      CajaConfigRepository cajaConfigRepo,
      MovimientoCajaRepository movimientoRepo,
      ApartadoRepository apartadoRepo,
      InversionRepository inversionRepo,
      CorteCajaRepository corteRepo,
      @Value("${app.import-on-startup:false}") boolean importOnStartup) {
    this.mapper = mapper;
    this.productoRepo = productoRepo;
    this.precioRepo = precioRepo;
    this.ventaRepo = ventaRepo;
    this.entradaRepo = entradaRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.movimientoRepo = movimientoRepo;
    this.apartadoRepo = apartadoRepo;
    this.inversionRepo = inversionRepo;
    this.corteRepo = corteRepo;
    this.importOnStartup = importOnStartup;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!importOnStartup) {
      return;
    }
    if (productoRepo.count() > 0) {
      log.info("BD ya tiene datos ({} productos). No se reimporta (Oracle es la fuente de verdad).", productoRepo.count());
      return;
    }
    try {
      log.info("BD vacía: importando semilla opcional desde classpath data/");
      TenantContext.set("mama");
      try {
        importFromClasspath("data/");
      } finally {
        TenantContext.clear();
      }
      log.info(
          "Importación completada: {} productos, {} precios, {} ventas, {} entradas, {} mov.caja, {} apartados, {} inversión",
          productoRepo.count(),
          precioRepo.count(),
          ventaRepo.count(),
          entradaRepo.count(),
          movimientoRepo.count(),
          apartadoRepo.count(),
          inversionRepo.count());
    } catch (Exception ex) {
      log.error("Fallo al importar semilla JSON", ex);
      throw new IllegalStateException("No se pudieron importar los datos semilla", ex);
    }
  }

  /** Importa JSON desde un prefijo classpath (p.ej. data/ o data-mama/). Requiere TenantContext. */
  @Transactional
  public void importFromClasspath(String classpathPrefix) throws IOException {
    String prefix = classpathPrefix.endsWith("/") ? classpathPrefix : classpathPrefix + "/";
    enableTenantFilter();
    importAll(prefix);
  }

  private void enableTenantFilter() {
    String tenant = TenantContext.require();
    Session session = entityManager.unwrap(Session.class);
    var filter = session.getEnabledFilter(TenantEntity.FILTER);
    if (filter == null) {
      session.enableFilter(TenantEntity.FILTER).setParameter("tenantId", tenant);
    } else {
      filter.setParameter("tenantId", tenant);
    }
  }

  private Producto findOrCreateProducto(String prodName, BigDecimal compraDefault) {
    String tenant = TenantContext.require();
    return productoRepo
        .findByNombreIgnoreCaseAndTenantId(prodName, tenant)
        .or(() -> productoRepo.findByNombreIgnoreCase(prodName))
        .orElseGet(() -> {
          Producto nuevo = new Producto();
          nuevo.setNombre(prodName);
          nuevo.setPrecioCompra(compraDefault != null ? compraDefault : BigDecimal.ZERO);
          nuevo.setCantidadInicial(BigDecimal.ZERO);
          nuevo.setTenantId(tenant);
          return productoRepo.save(nuevo);
        });
  }

  private void importAll(String prefix) throws IOException {
    String tenant = TenantContext.require();
    List<Map<String, Object>> inventario = readList(prefix, "inventario.json");
    for (Map<String, Object> row : inventario) {
      Producto p = new Producto();
      p.setNombre(str(row.get("nombre")));
      p.setPrecioCompra(nz(dec(row.get("precioCompra"))));
      p.setCantidadInicial(nz(dec(row.get("cantidadInicial"))));
      p.setTenantId(tenant);
      productoRepo.save(p);
    }

    List<Map<String, Object>> precios = readList(prefix, "historico-precios.json");
    for (Map<String, Object> row : precios) {
      String fechaStr = str(row.get("fechaVigencia"));
      String prodName = str(row.get("producto"));
      if (fechaStr == null || fechaStr.isBlank() || prodName == null) {
        continue;
      }
      Producto p = findOrCreateProducto(prodName, BigDecimal.ZERO);
      PrecioHistorico ph = new PrecioHistorico();
      ph.setProducto(p);
      ph.setFechaVigencia(LocalDate.parse(fechaStr));
      ph.setPrecio(nz(dec(row.get("precio"))));
      ph.setTenantId(tenant);
      precioRepo.save(ph);
    }

    List<Map<String, Object>> ventas = readList(prefix, "ventas.json");
    for (Map<String, Object> row : ventas) {
      String fechaStr = str(row.get("fecha"));
      String tipoRaw = str(row.get("tipoVenta"));
      if (fechaStr == null || fechaStr.isBlank() || tipoRaw == null) {
        continue;
      }
      TipoVenta tipo = TipoVenta.fromLabel(tipoRaw);
      Venta v = new Venta();
      v.setFecha(LocalDate.parse(fechaStr));
      v.setTipoVenta(tipo);
      v.setCantidad(nz(dec(row.get("cantidad"))));
      v.setTenantId(tenant);
      if (tipo.esProducto() && row.get("producto") != null) {
        v.setProducto(findOrCreateProducto(str(row.get("producto")), BigDecimal.ZERO));
      }
      if (tipo.totalEsCero()) {
        v.setTotal(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
      } else {
        v.setTotal(nz(dec(row.get("total"))));
      }
      ventaRepo.save(v);
    }

    List<Map<String, Object>> entradas = readList(prefix, "entradas.json");
    for (Map<String, Object> row : entradas) {
      String fechaStr = str(row.get("fecha"));
      String prodName = str(row.get("producto"));
      if (fechaStr == null || fechaStr.isBlank() || prodName == null) {
        continue;
      }
      Producto p = findOrCreateProducto(prodName, nz(dec(row.get("precioProveedor"))));
      Entrada e = new Entrada();
      e.setFecha(LocalDate.parse(fechaStr));
      e.setProducto(p);
      e.setCantidad(nz(dec(row.get("cantidad"))));
      e.setPrecioProveedor(dec(row.get("precioProveedor")));
      e.setTenantId(tenant);
      if (e.getPrecioProveedor() != null) {
        e.setTotal(e.getCantidad().multiply(e.getPrecioProveedor()).setScale(2, RoundingMode.HALF_UP));
      }
      entradaRepo.save(e);
    }

    Map<String, Object> cajaCfg = readObject(prefix, "caja-config.json");
    if (cajaCfg != null) {
      CajaConfig cfg = cajaConfigRepo.findByTenantId(tenant).orElseGet(CajaConfig::new);
      cfg.setTenantId(tenant);
      if (cfg.getId() == null) {
        cfg.setId(cajaConfigRepo.nextId());
      }
      if (cajaCfg.get("fechaInicio") != null) {
        cfg.setFechaInicio(LocalDate.parse(str(cajaCfg.get("fechaInicio"))));
      }
      if (cajaCfg.get("fechaFin") != null) {
        cfg.setFechaFin(LocalDate.parse(str(cajaCfg.get("fechaFin"))));
      }
      cfg.setFondoInicial(nz(dec(cajaCfg.get("fondoInicial"))));
      cajaConfigRepo.save(cfg);
    }

    // Cortes históricos (data-mama/cortes.json): chips como en admin.
    List<Map<String, Object>> cortes = readList(prefix, "cortes.json");
    LocalDate ultimoCorteImport = null;
    for (Map<String, Object> row : cortes) {
      String fechaStr = str(row.get("fecha"));
      if (fechaStr == null || fechaStr.isBlank()) continue;
      LocalDate fechaCorte = LocalDate.parse(fechaStr);
      if (corteRepo.findByFecha(fechaCorte).isPresent()) {
        ultimoCorteImport = fechaCorte;
        continue;
      }
      CorteCaja corte = new CorteCaja();
      corte.setTenantId(tenant);
      corte.setFecha(fechaCorte);
      corte.setFondoPeriodo(nz(dec(row.get("fondoPeriodo"))));
      corte.setParaApartar(nz(dec(row.get("paraApartar"))));
      BigDecimal tot = corte.getParaApartar().add(new BigDecimal("200")).setScale(2, RoundingMode.HALF_UP);
      corte.setTotalCaja(tot);
      corte.setTotalCalculadora(tot);
      corte.setTotalNegocio(tot);
      corteRepo.save(corte);
      ultimoCorteImport = fechaCorte;
    }
    if (ultimoCorteImport != null) {
      CajaConfig cfg = cajaConfigRepo.findByTenantId(tenant).orElse(null);
      if (cfg != null) {
        LocalDate inicio = ultimoCorteImport.plusDays(1);
        cfg.setFechaInicio(inicio);
        LocalDate hoy = LocalDate.now(java.time.ZoneId.of("America/Mexico_City"));
        cfg.setFechaFin(hoy.isBefore(inicio) ? inicio : hoy);
        cfg.setFondoInicial(new BigDecimal("200.00"));
        cajaConfigRepo.save(cfg);
      }
    }

    List<Map<String, Object>> movs = readList(prefix, "caja-movimientos.json");
    for (Map<String, Object> row : movs) {
      MovimientoCaja m = new MovimientoCaja();
      m.setFecha(LocalDate.parse(str(row.get("fecha"))));
      m.setTipo(TipoMovimientoCaja.valueOf(str(row.get("tipo"))));
      m.setMonto(nz(dec(row.get("monto"))));
      m.setTenantId(tenant);
      Object motivo = row.get("motivo");
      if (motivo != null && !str(motivo).isBlank()) {
        m.setMotivo(str(motivo));
      }
      movimientoRepo.save(m);
    }

    List<Map<String, Object>> apartados = readList(prefix, "apartados.json");
    for (Map<String, Object> row : apartados) {
      Apartado a = new Apartado();
      a.setFecha(LocalDate.parse(str(row.get("fecha"))));
      a.setCategoria(str(row.get("categoria")));
      a.setIngreso(nz(dec(row.get("ingreso"))));
      a.setTenantId(tenant);
      String tipo = str(row.get("tipo"));
      a.setTipo(tipo == null || tipo.isBlank()
          ? TipoMovimientoApartado.INGRESO
          : TipoMovimientoApartado.valueOf(tipo));
      a.setMotivo(str(row.get("motivo")));
      apartadoRepo.save(a);
    }

    Map<String, Object> inversion = readObject(prefix, "inversion.json");
    if (inversion != null) {
      Object productosObj = inversion.get("productos");
      if (productosObj instanceof List<?> productos) {
        for (Object o : productos) {
          @SuppressWarnings("unchecked")
          Map<String, Object> row = (Map<String, Object>) o;
          InversionItem item = new InversionItem();
          item.setTipo("PRODUCTO");
          item.setConcepto(str(row.get("nombre")));
          item.setCantidad(dec(row.get("cantidad")));
          item.setPrecioUnidad(dec(row.get("precioUnidad")));
          item.setMonto(dec(row.get("total")));
          item.setTenantId(tenant);
          inversionRepo.save(item);
        }
      }
      Object infraObj = inversion.get("infraestructura");
      if (infraObj instanceof List<?> infra) {
        for (Object o : infra) {
          @SuppressWarnings("unchecked")
          Map<String, Object> row = (Map<String, Object>) o;
          InversionItem item = new InversionItem();
          item.setTipo("INFRAESTRUCTURA");
          item.setConcepto(str(row.get("concepto")));
          item.setMonto(dec(row.get("monto")));
          item.setTenantId(tenant);
          inversionRepo.save(item);
        }
      }
    }
  }

  private List<Map<String, Object>> readList(String prefix, String file) throws IOException {
    byte[] bytes = readBytes(prefix, file);
    if (bytes == null) return List.of();
    return mapper.readValue(bytes, new TypeReference<>() {});
  }

  private Map<String, Object> readObject(String prefix, String file) throws IOException {
    byte[] bytes = readBytes(prefix, file);
    if (bytes == null) return null;
    return mapper.readValue(bytes, new TypeReference<>() {});
  }

  private byte[] readBytes(String prefix, String file) throws IOException {
    ClassPathResource resource = new ClassPathResource(prefix + file);
    if (resource.exists()) {
      byte[] bytes = resource.getInputStream().readAllBytes();
      if (bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF) {
        byte[] sinBom = new byte[bytes.length - 3];
        System.arraycopy(bytes, 3, sinBom, 0, sinBom.length);
        return sinBom;
      }
      return bytes;
    }
    log.warn("No se encontró semilla classpath {}{}", prefix, file);
    return null;
  }

  private static String str(Object o) {
    return o == null ? null : String.valueOf(o).trim();
  }

  private static BigDecimal dec(Object o) {
    if (o == null) return null;
    if (o instanceof Number n) {
      return BigDecimal.valueOf(n.doubleValue());
    }
    String s = String.valueOf(o).trim();
    if (s.isEmpty() || s.equals("-") || s.equalsIgnoreCase("null")) return null;
    return new BigDecimal(s);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
