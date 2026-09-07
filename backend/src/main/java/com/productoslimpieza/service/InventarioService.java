package com.productoslimpieza.service;

import com.productoslimpieza.domain.MargenConfig;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.ProduccionRepository;
import com.productoslimpieza.repo.TraspasoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.InventarioDto;
import com.productoslimpieza.web.dto.ProductoRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventarioService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final ProductoRepository productoRepo;
  private final EntradaRepository entradaRepo;
  private final VentaRepository ventaRepo;
  private final ProduccionRepository produccionRepo;
  private final TraspasoRepository traspasoRepo;
  private final PrecioService precioService;
  private final PrecioHistoricoService precioHistoricoService;
  private final MargenService margenService;

  public InventarioService(
      ProductoRepository productoRepo,
      EntradaRepository entradaRepo,
      VentaRepository ventaRepo,
      ProduccionRepository produccionRepo,
      TraspasoRepository traspasoRepo,
      PrecioService precioService,
      PrecioHistoricoService precioHistoricoService,
      MargenService margenService) {
    this.productoRepo = productoRepo;
    this.entradaRepo = entradaRepo;
    this.ventaRepo = ventaRepo;
    this.produccionRepo = produccionRepo;
    this.traspasoRepo = traspasoRepo;
    this.precioService = precioService;
    this.precioHistoricoService = precioHistoricoService;
    this.margenService = margenService;
  }

  @Transactional(readOnly = true)
  public List<InventarioDto> listar() {
    MargenConfig margen = margenService.getConfig();
    return productoRepo.findAllByOrderByNombreAsc().stream()
        .map(p -> toDto(p, margen))
        .toList();
  }

  /** Recalcula menudeo + mayoreo (≥5 / ≥10) de todos los productos según márgenes. */
  @Transactional
  public void aplicarPreciosDesdeMargenes(MargenConfig margen) {
    for (Producto p : productoRepo.findAllByOrderByNombreAsc()) {
      BigDecimal compra = nz(p.getPrecioCompra());
      if (compra.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      BigDecimal menudeo = conMargen(compra, margen.getMargenMax());
      BigDecimal m5 = conMargen(compra, margen.getMargenMayoreo5());
      BigDecimal m10 = conMargen(compra, margen.getMargenMayoreo10());
      // Actualiza la vigencia actual; no inserta un cambio con fecha de hoy
      LocalDate fecha = precioHistoricoService.fechaVigenciaActual(p).orElse(null);
      if (fecha != null) {
        precioHistoricoService.crearDirecto(p, fecha, menudeo);
      }
      p.setPrecioMayoreo5(m5);
      p.setPrecioMayoreo10(m10);
      productoRepo.save(p);
    }
  }

  @Transactional
  public InventarioDto crear(ProductoRequest req) {
    if (productoRepo.existsByNombreIgnoreCase(req.nombre().trim())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un producto con ese nombre");
    }
    MargenConfig margen = margenService.getConfig();
    Producto p = new Producto();
    p.setNombre(req.nombre().trim());
    p.setPrecioCompra(nz(req.precioCompra()));
    p.setCantidadInicial(nz(req.cantidadInicial()));
    aplicarMayoreoDesdeCompra(p, margen);
    p = productoRepo.save(p);
    LocalDate fecha = req.fechaVigenciaPrecio() != null ? req.fechaVigenciaPrecio() : null;
    if (req.precioVenta() != null) {
      if (fecha == null || fecha.equals(LocalDate.now(ZONA))) {
        fecha = precioHistoricoService.fechaVigenciaActual(p).orElse(fecha);
      }
      if (fecha == null) {
        fecha = LocalDate.now(ZONA);
      }
      precioHistoricoService.crearDirecto(p, fecha, req.precioVenta());
    } else if (p.getPrecioCompra().compareTo(BigDecimal.ZERO) > 0) {
      // Alta nueva sin precio: usa margen máx. sobre la primera fecha de vigencia existente o hoy solo si no hay histórico
      LocalDate f = precioHistoricoService.fechaVigenciaActual(p).orElse(LocalDate.now(ZONA));
      precioHistoricoService.crearDirecto(p, f, conMargen(p.getPrecioCompra(), margen.getMargenMax()));
    }
    return toDto(p, margen);
  }

  @Transactional
  public InventarioDto actualizar(Long id, ProductoRequest req) {
    Producto p = productoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    productoRepo.findByNombreIgnoreCase(req.nombre().trim()).ifPresent(other -> {
      if (!other.getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un producto con ese nombre");
      }
    });
    MargenConfig margen = margenService.getConfig();
    p.setNombre(req.nombre().trim());
    if (req.precioCompra() != null) {
      p.setPrecioCompra(req.precioCompra());
    }
    if (req.cantidadInicial() != null) {
      p.setCantidadInicial(req.cantidadInicial());
    }
    // Precios mayoreo manuales; si no vienen y cambió compra, recalcular desde márgenes
    if (req.precioMayoreo5() != null || req.precioMayoreo10() != null) {
      if (req.precioMayoreo5() != null) {
        p.setPrecioMayoreo5(req.precioMayoreo5());
      }
      if (req.precioMayoreo10() != null) {
        p.setPrecioMayoreo10(req.precioMayoreo10());
      }
    } else if (req.precioCompra() != null) {
      aplicarMayoreoDesdeCompra(p, margen);
    }
    p = productoRepo.save(p);
    if (req.precioVenta() != null) {
      BigDecimal actual = precioService.precioHoy(p);
      if (req.precioVenta().compareTo(actual) != 0) {
        // Actualiza el precio vigente sin crear una fila nueva con la fecha de hoy
        LocalDate fecha = req.fechaVigenciaPrecio();
        if (fecha == null || fecha.equals(LocalDate.now(ZONA))) {
          fecha = precioHistoricoService.fechaVigenciaActual(p).orElse(null);
        }
        if (fecha != null) {
          precioHistoricoService.crearDirecto(p, fecha, req.precioVenta());
        }
      }
    }
    return toDto(p, margen);
  }

  private void aplicarMayoreoDesdeCompra(Producto p, MargenConfig margen) {
    BigDecimal compra = nz(p.getPrecioCompra());
    if (compra.compareTo(BigDecimal.ZERO) <= 0) {
      return;
    }
    p.setPrecioMayoreo5(conMargen(compra, margen.getMargenMayoreo5()));
    p.setPrecioMayoreo10(conMargen(compra, margen.getMargenMayoreo10()));
  }

  private static BigDecimal conMargen(BigDecimal compra, BigDecimal margen) {
    return compra.multiply(BigDecimal.ONE.add(nz(margen))).setScale(2, RoundingMode.HALF_UP);
  }

  private InventarioDto toDto(Producto p, MargenConfig margen) {
    BigDecimal venta = precioService.precioHoy(p);
    BigDecimal compra = nz(p.getPrecioCompra());
    BigDecimal margenMin = nz(margen.getMargenMin());
    BigDecimal margenMax = nz(margen.getMargenMax());
    BigDecimal min = conMargen(compra, margenMin);
    BigDecimal max = conMargen(compra, margenMax);
    BigDecimal mayoreo5 = p.getPrecioMayoreo5() != null
        ? p.getPrecioMayoreo5()
        : conMargen(compra, margen.getMargenMayoreo5());
    BigDecimal mayoreo10 = p.getPrecioMayoreo10() != null
        ? p.getPrecioMayoreo10()
        : conMargen(compra, margen.getMargenMayoreo10());

    BigDecimal entradas = nz(entradaRepo.sumCantidadByProducto(p));
    BigDecimal producido = nz(produccionRepo.sumResultadoByProducto(p));
    BigDecimal consumidoPrep = nz(produccionRepo.sumInsumoByProducto(p));
    BigDecimal traspasos = nz(traspasoRepo.sumCantidadByProducto(p));
    BigDecimal salidasUnidades = nz(ventaRepo.sumCantidadByProductoAndTipos(
        p, List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.MUESTRA, TipoVenta.CASA, TipoVenta.MAYOREO)));
    BigDecimal pesos = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.PESOS));
    BigDecimal equivPesos = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0 && pesos.compareTo(BigDecimal.ZERO) > 0) {
      equivPesos = pesos.divide(venta, 4, RoundingMode.HALF_UP);
    }
    BigDecimal stock = nz(p.getCantidadInicial())
        .add(entradas)
        .add(producido)
        .subtract(consumidoPrep)
        .subtract(traspasos)
        .subtract(salidasUnidades)
        .subtract(equivPesos)
        .setScale(2, RoundingMode.HALF_UP);

    BigDecimal casa = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.CASA));
    BigDecimal casaMonto = casa.multiply(compra).setScale(2, RoundingMode.HALF_UP);

    BigDecimal ganancia = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0) {
      ganancia = venta.subtract(compra).divide(venta, 4, RoundingMode.HALF_UP)
          .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
    }

    boolean bajoMinimo = venta.compareTo(BigDecimal.ZERO) > 0 && venta.compareTo(min) < 0;

    return new InventarioDto(
        p.getId(),
        p.getNombre(),
        venta,
        mayoreo5,
        mayoreo10,
        compra,
        min,
        max,
        nz(p.getCantidadInicial()),
        stock,
        casa,
        casaMonto,
        ganancia,
        bajoMinimo
    );
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
