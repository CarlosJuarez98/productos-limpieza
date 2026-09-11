package com.productoslimpieza.service;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.CorteCaja;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.CorteCajaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.tenant.TenantEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import javax.sql.DataSource;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Ajustes ligeros sobre Oracle. No lee Excel ni JSON de semilla.
 */
@Component
@Order(2)
public class DataNormalizeRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataNormalizeRunner.class);
  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
  private static final BigDecimal FONDO_POST_CORTE = new BigDecimal("200.00");
  private static final List<String> TENANTS = List.of("mama", "admin");

  private final VentaRepository ventaRepo;
  private final ApartadoRepository apartadoRepo;
  private final CorteCajaRepository corteRepo;
  private final CajaConfigRepository cajaConfigRepo;
  private final ProductoRepository productoRepo;
  private final DataSource dataSource;
  private final TransactionTemplate txTemplate;

  @PersistenceContext
  private EntityManager entityManager;

  public DataNormalizeRunner(
      VentaRepository ventaRepo,
      ApartadoRepository apartadoRepo,
      CorteCajaRepository corteRepo,
      CajaConfigRepository cajaConfigRepo,
      ProductoRepository productoRepo,
      DataSource dataSource,
      PlatformTransactionManager txManager) {
    this.ventaRepo = ventaRepo;
    this.apartadoRepo = apartadoRepo;
    this.corteRepo = corteRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.productoRepo = productoRepo;
    this.dataSource = dataSource;
    this.txTemplate = new TransactionTemplate(txManager);
  }

  @Override
  public void run(ApplicationArguments args) {
    permitirCategoriaServicios();
    for (String tenant : TENANTS) {
      TenantContext.set(tenant);
      try {
        txTemplate.executeWithoutResult(status -> {
          enableTenantFilter();
          normalizarVentasMuestraCero();
          normalizarApartadosTipo();
          alinearPeriodoAlUltimoCorte();
          normalizarParaApartarCortes();
          normalizarVendePorProductos();
        });
      } finally {
        TenantContext.clear();
      }
    }
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

  private void permitirCategoriaServicios() {
    try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
      // Quitar CHECK rígidos: rubros dinámicos (códigos libres por tenant).
      try {
        st.execute("ALTER TABLE apartados DROP CONSTRAINT SYS_C008305");
      } catch (Exception ignored) {
      }
      try {
        st.execute("ALTER TABLE apartados DROP CONSTRAINT apartados_categoria_chk");
      } catch (Exception ignored) {
      }
    } catch (Exception e) {
      log.debug("DDL apartados omitido: {}", e.getMessage());
    }
    try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
      st.execute("ALTER TABLE apartados MODIFY categoria VARCHAR2(40)");
    } catch (Exception e) {
      log.debug("Ampliar categoria omitido: {}", e.getMessage());
    }
  }

  private void normalizarVentasMuestraCero() {
    List<Venta> malas = ventaRepo.findAll().stream()
        .filter(v -> v.getTipoVenta() == TipoVenta.MUESTRA)
        .filter(v -> v.getTotal() != null && v.getTotal().compareTo(BigDecimal.ZERO) != 0)
        .toList();
    if (malas.isEmpty()) {
      return;
    }
    BigDecimal cero = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    for (Venta v : malas) {
      v.setTotal(cero);
    }
    ventaRepo.saveAll(malas);
    log.info("[{}] Normalizadas {} ventas Muestra a total $0", TenantContext.get(), malas.size());
  }

  private void normalizarApartadosTipo() {
    List<Apartado> sinTipo = apartadoRepo.findAll().stream()
        .filter(a -> a.getTipo() == null)
        .toList();
    if (sinTipo.isEmpty()) {
      return;
    }
    for (Apartado a : sinTipo) {
      a.setTipo(TipoMovimientoApartado.INGRESO);
    }
    apartadoRepo.saveAll(sinTipo);
    log.info("[{}] Normalizados {} apartados sin tipo → INGRESO", TenantContext.get(), sinTipo.size());
  }

  /** Periodo = día siguiente al último corte en BD. */
  private void alinearPeriodoAlUltimoCorte() {
    LocalDate ultimo = corteRepo.findMaxFecha().orElse(null);
    if (ultimo == null) {
      return;
    }
    LocalDate inicioEsperado = ultimo.plusDays(1);
    String tenant = TenantContext.require();
    CajaConfig cfg = cajaConfigRepo.findByTenantId(tenant).orElseGet(() -> {
      CajaConfig c = new CajaConfig();
      c.setId(cajaConfigRepo.nextId());
      c.setTenantId(tenant);
      return c;
    });
    if (cfg.getId() == null) {
      cfg.setId(cajaConfigRepo.nextId());
    }
    boolean cambio = false;
    if (cfg.getFechaInicio() == null || !inicioEsperado.equals(cfg.getFechaInicio())) {
      cfg.setFechaInicio(inicioEsperado);
      cambio = true;
    }
    LocalDate hoy = LocalDate.now(ZONA);
    if (cfg.getFechaFin() == null || cfg.getFechaFin().isBefore(inicioEsperado)) {
      cfg.setFechaFin(hoy.isBefore(inicioEsperado) ? inicioEsperado : hoy);
      cambio = true;
    }
    if (cfg.getFondoInicial() == null
        || cfg.getFondoInicial().compareTo(new BigDecimal("500")) >= 0) {
      cfg.setFondoInicial(FONDO_POST_CORTE);
      cambio = true;
    }
    if (cambio) {
      cajaConfigRepo.save(cfg);
      log.info(
          "[{}] Periodo alineado al último corte {}: inicio={}, fin={}, fondo={}",
          tenant,
          ultimo,
          cfg.getFechaInicio(),
          cfg.getFechaFin(),
          cfg.getFondoInicial());
    }
  }

  /** paraApartar = contado (o total caja) − fondo $200 que queda en caja. */
  private void normalizarParaApartarCortes() {
    BigDecimal fondo = FONDO_POST_CORTE;
    CajaConfig cfg = cajaConfigRepo.findByTenantId(TenantContext.require()).orElse(null);
    if (cfg != null && cfg.getFondoInicial() != null && cfg.getFondoInicial().compareTo(BigDecimal.ZERO) > 0) {
      fondo = cfg.getFondoInicial();
    }
    int n = 0;
    for (CorteCaja c : corteRepo.findAllByOrderByFechaAsc()) {
      BigDecimal cajaTot = c.getTotalCaja() != null ? c.getTotalCaja() : BigDecimal.ZERO;
      BigDecimal calc =
          c.getTotalCalculadora() != null && c.getTotalCalculadora().compareTo(BigDecimal.ZERO) > 0
              ? c.getTotalCalculadora()
              : BigDecimal.ZERO;
      BigDecimal contado = calc.max(cajaTot);
      BigDecimal para = contado.subtract(fondo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
      if (c.getParaApartar() != null && c.getParaApartar().compareTo(para) == 0) {
        continue;
      }
      c.setParaApartar(para);
      corteRepo.save(c);
      n++;
      log.info(
          "[{}] Corte {}: paraApartar=${} (contado ${} − fondo ${})",
          TenantContext.get(),
          c.getFecha(),
          para,
          contado,
          fondo);
    }
    if (n > 0) {
      log.info("[{}] Completado paraApartar en {} corte(s)", TenantContext.get(), n);
    }
  }

  /** Completa vendePor en productos (default Litros; Pieza si el nombre lo sugiere). */
  private void normalizarVendePorProductos() {
    int n = 0;
    for (Producto p : productoRepo.findAll()) {
      if (p.getVendePor() != null) {
        continue;
      }
      String nom = p.getNombre() != null ? p.getNombre().toLowerCase() : "";
      UnidadVenta u =
          nom.contains("pieza") || nom.contains(" pza") || nom.endsWith(" pza") || nom.contains("pz ")
              ? UnidadVenta.PIEZA
              : UnidadVenta.LITROS;
      p.setVendePor(u);
      productoRepo.save(p);
      n++;
    }
    if (n > 0) {
      log.info("[{}] Asignado vendePor a {} producto(s)", TenantContext.get(), n);
    }
  }
}
