package com.productoslimpieza.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.productoslimpieza.domain.*;
import com.productoslimpieza.repo.*;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
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
  private final boolean importOnStartup;
  private final boolean forceImport;
  private final String seedPath;

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
      @Value("${app.import-on-startup:true}") boolean importOnStartup,
      @Value("${app.force-import:false}") boolean forceImport,
      @Value("${app.seed-path:../data}") String seedPath) {
    this.mapper = mapper;
    this.productoRepo = productoRepo;
    this.precioRepo = precioRepo;
    this.ventaRepo = ventaRepo;
    this.entradaRepo = entradaRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.movimientoRepo = movimientoRepo;
    this.apartadoRepo = apartadoRepo;
    this.inversionRepo = inversionRepo;
    this.importOnStartup = importOnStartup;
    this.forceImport = forceImport;
    this.seedPath = seedPath;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!importOnStartup) {
      return;
    }
    if (!forceImport && productoRepo.count() > 0) {
      log.info("BD ya tiene datos ({} productos). No se reimporta.", productoRepo.count());
      return;
    }
    try {
      if (forceImport) {
        log.info("Forzando reimportación: limpiando tablas...");
        clearAll();
      }
      log.info("Importando Excel (data/) desde {}", seedPath);
      importAll();
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
      log.error("Fallo al importar datos del Excel", ex);
      throw new IllegalStateException("No se pudieron importar los datos del Excel", ex);
    }
  }

  private void clearAll() {
    ventaRepo.deleteAllInBatch();
    entradaRepo.deleteAllInBatch();
    precioRepo.deleteAllInBatch();
    movimientoRepo.deleteAllInBatch();
    apartadoRepo.deleteAllInBatch();
    inversionRepo.deleteAllInBatch();
    cajaConfigRepo.deleteAllInBatch();
    productoRepo.deleteAllInBatch();
  }

  private void importAll() throws IOException {
    List<Map<String, Object>> inventario = readList("inventario.json");
    for (Map<String, Object> row : inventario) {
      Producto p = new Producto();
      p.setNombre(str(row.get("nombre")));
      p.setPrecioCompra(nz(dec(row.get("precioCompra"))));
      p.setCantidadInicial(nz(dec(row.get("cantidadInicial"))));
      productoRepo.save(p);
    }

    List<Map<String, Object>> precios = readList("historico-precios.json");
    for (Map<String, Object> row : precios) {
      String fechaStr = str(row.get("fechaVigencia"));
      String prodName = str(row.get("producto"));
      if (fechaStr == null || fechaStr.isBlank() || prodName == null) {
        continue;
      }
      Producto p = productoRepo.findByNombreIgnoreCase(prodName).orElseGet(() -> {
        Producto nuevo = new Producto();
        nuevo.setNombre(prodName);
        nuevo.setPrecioCompra(BigDecimal.ZERO);
        nuevo.setCantidadInicial(BigDecimal.ZERO);
        return productoRepo.save(nuevo);
      });
      PrecioHistorico ph = new PrecioHistorico();
      ph.setProducto(p);
      ph.setFechaVigencia(LocalDate.parse(fechaStr));
      ph.setPrecio(nz(dec(row.get("precio"))));
      precioRepo.save(ph);
    }

    List<Map<String, Object>> ventas = readList("ventas.json");
    for (Map<String, Object> row : ventas) {
      String fechaStr = str(row.get("fecha"));
      String tipoRaw = str(row.get("tipoVenta"));
      if (fechaStr == null || fechaStr.isBlank() || tipoRaw == null) {
        continue;
      }
      TipoVenta tipo = TipoVenta.fromExcel(tipoRaw);
      Venta v = new Venta();
      v.setFecha(LocalDate.parse(fechaStr));
      v.setTipoVenta(tipo);
      v.setCantidad(nz(dec(row.get("cantidad"))));
      if (tipo.esProducto() && row.get("producto") != null) {
        String prodName = str(row.get("producto"));
        Producto p = productoRepo.findByNombreIgnoreCase(prodName).orElseGet(() -> {
          Producto nuevo = new Producto();
          nuevo.setNombre(prodName);
          nuevo.setPrecioCompra(BigDecimal.ZERO);
          nuevo.setCantidadInicial(BigDecimal.ZERO);
          return productoRepo.save(nuevo);
        });
        v.setProducto(p);
      }
      // Total tal cual viene del Excel
      v.setTotal(nz(dec(row.get("total"))));
      ventaRepo.save(v);
    }

    List<Map<String, Object>> entradas = readList("entradas.json");
    for (Map<String, Object> row : entradas) {
      String fechaStr = str(row.get("fecha"));
      String prodName = str(row.get("producto"));
      if (fechaStr == null || fechaStr.isBlank() || prodName == null) {
        continue;
      }
      Producto p = productoRepo.findByNombreIgnoreCase(prodName).orElseGet(() -> {
        Producto nuevo = new Producto();
        nuevo.setNombre(prodName);
        nuevo.setPrecioCompra(nz(dec(row.get("precioProveedor"))));
        nuevo.setCantidadInicial(BigDecimal.ZERO);
        return productoRepo.save(nuevo);
      });
      Entrada e = new Entrada();
      e.setFecha(LocalDate.parse(fechaStr));
      e.setProducto(p);
      e.setCantidad(nz(dec(row.get("cantidad"))));
      e.setPrecioProveedor(dec(row.get("precioProveedor")));
      if (e.getPrecioProveedor() != null) {
        e.setTotal(e.getCantidad().multiply(e.getPrecioProveedor()).setScale(2, RoundingMode.HALF_UP));
      }
      entradaRepo.save(e);
    }

    Map<String, Object> cajaCfg = readObject("caja-config.json");
    if (cajaCfg != null) {
      CajaConfig cfg = new CajaConfig();
      cfg.setId(1L);
      if (cajaCfg.get("fechaInicio") != null) {
        cfg.setFechaInicio(LocalDate.parse(str(cajaCfg.get("fechaInicio"))));
      }
      if (cajaCfg.get("fechaFin") != null) {
        cfg.setFechaFin(LocalDate.parse(str(cajaCfg.get("fechaFin"))));
      }
      cfg.setFondoInicial(nz(dec(cajaCfg.get("fondoInicial"))));
      cajaConfigRepo.save(cfg);
    }

    List<Map<String, Object>> movs = readList("caja-movimientos.json");
    for (Map<String, Object> row : movs) {
      MovimientoCaja m = new MovimientoCaja();
      m.setFecha(LocalDate.parse(str(row.get("fecha"))));
      m.setTipo(TipoMovimientoCaja.valueOf(str(row.get("tipo"))));
      m.setMonto(nz(dec(row.get("monto"))));
      Object motivo = row.get("motivo");
      if (motivo != null && !str(motivo).isBlank()) {
        m.setMotivo(str(motivo));
      }
      movimientoRepo.save(m);
    }

    List<Map<String, Object>> apartados = readList("apartados.json");
    for (Map<String, Object> row : apartados) {
      Apartado a = new Apartado();
      a.setFecha(LocalDate.parse(str(row.get("fecha"))));
      a.setCategoria(CategoriaApartado.valueOf(str(row.get("categoria"))));
      a.setIngreso(nz(dec(row.get("ingreso"))));
      apartadoRepo.save(a);
    }

    Map<String, Object> inversion = readObject("inversion.json");
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
          inversionRepo.save(item);
        }
      }
    }
  }

  private List<Map<String, Object>> readList(String file) throws IOException {
    byte[] bytes = readBytes(file);
    if (bytes == null) return List.of();
    return mapper.readValue(bytes, new TypeReference<>() {});
  }

  private Map<String, Object> readObject(String file) throws IOException {
    byte[] bytes = readBytes(file);
    if (bytes == null) return null;
    return mapper.readValue(bytes, new TypeReference<>() {});
  }

  private byte[] readBytes(String file) throws IOException {
    Path external = Path.of(seedPath, file).toAbsolutePath().normalize();
    if (Files.exists(external)) {
      return Files.readAllBytes(external);
    }
    ClassPathResource resource = new ClassPathResource("data/" + file);
    if (resource.exists()) {
      return resource.getInputStream().readAllBytes();
    }
    log.warn("No se encontró archivo semilla: {}", file);
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
