package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.CorteCaja;
import com.productoslimpieza.domain.PrecioHistorico;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.CorteCajaRepository;
import com.productoslimpieza.repo.PrecioHistoricoRepository;
import com.productoslimpieza.repo.VentaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Normaliza reglas de negocio en la BD (fuente de verdad).
 */
@Component
@Order(2)
public class DataNormalizeRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataNormalizeRunner.class);
  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
  private static final BigDecimal FONDO_POST_CORTE = new BigDecimal("200.00");

  private final VentaRepository ventaRepo;
  private final PrecioHistoricoRepository precioRepo;
  private final ApartadoRepository apartadoRepo;
  private final CorteCajaRepository corteRepo;
  private final CajaConfigRepository cajaConfigRepo;
  private final ObjectMapper mapper;
  private final String seedPath;
  private final DataSource dataSource;
  private final TransactionTemplate txTemplate;

  public DataNormalizeRunner(
      VentaRepository ventaRepo,
      PrecioHistoricoRepository precioRepo,
      ApartadoRepository apartadoRepo,
      CorteCajaRepository corteRepo,
      CajaConfigRepository cajaConfigRepo,
      ObjectMapper mapper,
      DataSource dataSource,
      PlatformTransactionManager txManager,
      @Value("${app.seed-path:../data}") String seedPath) {
    this.ventaRepo = ventaRepo;
    this.precioRepo = precioRepo;
    this.apartadoRepo = apartadoRepo;
    this.corteRepo = corteRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.mapper = mapper;
    this.dataSource = dataSource;
    this.txTemplate = new TransactionTemplate(txManager);
    this.seedPath = seedPath;
  }

  @Override
  public void run(ApplicationArguments args) {
    // DDL fuera de transacción Spring: errores ORA catchados no marcan rollback-only.
    permitirCategoriaServicios();
    txTemplate.executeWithoutResult(status -> {
      normalizarVentasMuestraCero();
      quitarPreciosMasivosDeHoy();
      normalizarApartadosTipo();
      asegurarApartadoServiciosExcel();
      asegurarCortesExcel();
      alinearPeriodoAlUltimoCorte();
    });
  }

  /**
   * Oracle CHECK antiguo puede no incluir SERVICIOS. Se ejecuta por JDBC directo
   * (sin @Transactional) para que ORA-02443 / ORA-02264 no contaminen la TX de datos.
   */
  private void permitirCategoriaServicios() {
    try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
      try {
        st.execute("ALTER TABLE apartados DROP CONSTRAINT SYS_C008305");
        log.info("Constraint SYS_C008305 eliminada");
      } catch (Exception e) {
        log.debug("No se pudo eliminar SYS_C008305 (puede no existir): {}", e.getMessage());
      }
      try {
        st.execute(
            """
            ALTER TABLE apartados ADD CONSTRAINT apartados_categoria_chk
            CHECK (categoria IN ('GENERAL','PRODUCTOS','CASA','SALARIOS','SERVICIOS'))
            """);
        log.info("Constraint apartados_categoria_chk creada (incluye SERVICIOS)");
      } catch (Exception e) {
        log.debug("Constraint apartados_categoria_chk: {}", e.getMessage());
      }
    } catch (Exception e) {
      log.debug("DDL apartados_categoria_chk omitido: {}", e.getMessage());
    }
  }

  /** Solo Muestra debe forzar $0. Casa en Excel a veces trae monto (ej. $51). */
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
    log.info("Normalizadas {} ventas Muestra a total $0", malas.size());
  }

  private void quitarPreciosMasivosDeHoy() {
    LocalDate hoy = LocalDate.now(ZONA);
    List<PrecioHistorico> deHoy = precioRepo.findAll().stream()
        .filter(p -> hoy.equals(p.getFechaVigencia()))
        .toList();
    if (deHoy.size() < 50) {
      return;
    }
    precioRepo.deleteAll(deHoy);
    log.info(
        "Eliminados {} precios con fecha {} (carga masiva; el histórico queda como en Excel)",
        deHoy.size(),
        hoy);
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
    log.info("Normalizados {} apartados sin tipo → INGRESO", sinTipo.size());
  }

  /** Excel Caja columna Apartados servicios: 22/12/2025 = $194. */
  private void asegurarApartadoServiciosExcel() {
    BigDecimal monto = new BigDecimal("194.00");
    LocalDate fecha = LocalDate.of(2025, 12, 22);
    boolean existe = apartadoRepo.findAll().stream()
        .anyMatch(a -> a.getCategoria() == CategoriaApartado.SERVICIOS
            && fecha.equals(a.getFecha())
            && a.getIngreso() != null
            && a.getIngreso().compareTo(monto) == 0);
    if (existe) {
      return;
    }
    Apartado a = new Apartado();
    a.setFecha(fecha);
    a.setCategoria(CategoriaApartado.SERVICIOS);
    a.setIngreso(monto);
    a.setTipo(TipoMovimientoApartado.INGRESO);
    a.setMotivo("Apartados servicios");
    apartadoRepo.save(a);
    log.info("Creado apartado SERVICIOS $194 (Excel Caja)");
  }

  /** Fechas naranjas de Excel Ventas = cortes de caja. */
  private void asegurarCortesExcel() {
    List<String> fechas;
    try {
      Path p = Path.of(seedPath, "cortes.json");
      if (Files.exists(p)) {
        fechas = mapper.readValue(Files.readString(p), new TypeReference<>() {});
      } else {
        fechas = mapper.readValue(
            new ClassPathResource("data/cortes.json").getInputStream(),
            new TypeReference<>() {});
      }
    } catch (Exception e) {
      log.warn("No se pudo leer cortes.json: {}", e.getMessage());
      return;
    }
    int added = 0;
    for (String iso : fechas) {
      LocalDate f = LocalDate.parse(iso);
      if (!corteRepo.existsByFecha(f)) {
        CorteCaja c = new CorteCaja();
        c.setFecha(f);
        corteRepo.save(c);
        added++;
      }
    }
    if (added > 0) {
      log.info("Cargados {} cortes desde Excel (fechas naranjas Ventas)", added);
    }
  }

  /**
   * Periodo actual = día siguiente al último corte (como en Excel: ese día ya no cuenta).
   */
  private void alinearPeriodoAlUltimoCorte() {
    LocalDate ultimo = corteRepo.findMaxFecha().orElse(null);
    if (ultimo == null) {
      return;
    }
    LocalDate inicioEsperado = ultimo.plusDays(1);
    CajaConfig cfg = cajaConfigRepo.findById(1L).orElseGet(() -> {
      CajaConfig c = new CajaConfig();
      c.setId(1L);
      return c;
    });
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
      // Fondo largo histórico (790) → fondo post-corte $200
      cfg.setFondoInicial(FONDO_POST_CORTE);
      cambio = true;
    }
    if (cambio) {
      cajaConfigRepo.save(cfg);
      log.info(
          "Periodo alineado al último corte {}: inicio={}, fin={}, fondo={}",
          ultimo,
          cfg.getFechaInicio(),
          cfg.getFechaFin(),
          cfg.getFondoInicial());
    }
  }
}
