package com.productoslimpieza.service;

import com.productoslimpieza.domain.MargenConfig;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.repo.AjusteInventarioRepository;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.PedidoItemRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.ProduccionRepository;
import com.productoslimpieza.repo.TraspasoLineaRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantGuard;
import com.productoslimpieza.util.NombreNatural;
import com.productoslimpieza.web.dto.InventarioDto;
import com.productoslimpieza.web.dto.ProductoRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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
  private final TraspasoLineaRepository traspasoLineaRepo;
  private final AjusteInventarioRepository ajusteRepo;
  private final PedidoItemRepository pedidoItemRepo;
  private final PrecioService precioService;
  private final PrecioHistoricoService precioHistoricoService;
  private final MargenService margenService;

  public InventarioService(
      ProductoRepository productoRepo,
      EntradaRepository entradaRepo,
      VentaRepository ventaRepo,
      ProduccionRepository produccionRepo,
      TraspasoLineaRepository traspasoLineaRepo,
      AjusteInventarioRepository ajusteRepo,
      PedidoItemRepository pedidoItemRepo,
      PrecioService precioService,
      PrecioHistoricoService precioHistoricoService,
      MargenService margenService) {
    this.productoRepo = productoRepo;
    this.entradaRepo = entradaRepo;
    this.ventaRepo = ventaRepo;
    this.produccionRepo = produccionRepo;
    this.traspasoLineaRepo = traspasoLineaRepo;
    this.ajusteRepo = ajusteRepo;
    this.pedidoItemRepo = pedidoItemRepo;
    this.precioService = precioService;
    this.precioHistoricoService = precioHistoricoService;
    this.margenService = margenService;
  }

  @Transactional(readOnly = true)
  public List<InventarioDto> listar() {
    MargenConfig margen = margenService.getConfig();
    return productoRepo.findByActivoTrueOrderByNombreAsc().stream()
        .map(p -> toDto(p, margen))
        .sorted(Comparator.comparing(InventarioDto::nombre, NombreNatural.comparator()))
        .toList();
  }

  /** Recalcula solo mayoreo (≥5 / ≥10). El menudeo vive en el histórico y no se sobrescribe. */
  @Transactional
  public void aplicarPreciosDesdeMargenes(MargenConfig margen) {
    for (Producto p : productoRepo.findByActivoTrueOrderByNombreAsc()) {
      BigDecimal compra = nz(p.getPrecioCompra());
      if (compra.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      aplicarMayoreoDesdeCompra(p, margen);
      productoRepo.save(p);
    }
  }

  @Transactional
  public InventarioDto crear(ProductoRequest req) {
    String nombre = req.nombre().trim();
    Optional<Producto> existente = productoRepo.findByNombreIgnoreCase(nombre);
    if (existente.isPresent()) {
      Producto previo = existente.get();
      if (previo.isActivo()) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un producto con ese nombre");
      }
      // Reactivar producto dado de baja (conserva su historial).
      MargenConfig margen = margenService.getConfig();
      previo.setActivo(true);
      previo.setNombre(nombre);
      if (req.precioCompra() != null) {
        previo.setPrecioCompra(nz(req.precioCompra()));
      }
      if (req.cantidadInicial() != null) {
        previo.setCantidadInicial(nz(req.cantidadInicial()));
      }
      if (req.vendePor() != null) {
        previo.setVendePor(req.vendePor());
      }
      aplicarMayoreoDesdeCompra(previo, margen);
      previo = productoRepo.save(previo);
      if (req.precioVenta() != null) {
        LocalDate fecha = req.fechaVigenciaPrecio() != null ? req.fechaVigenciaPrecio() : LocalDate.now(ZONA);
        precioHistoricoService.crearDirecto(previo, fecha, req.precioVenta());
      }
      return toDto(previo, margen);
    }
    MargenConfig margen = margenService.getConfig();
    Producto p = new Producto();
    p.setNombre(nombre);
    p.setPrecioCompra(nz(req.precioCompra()));
    p.setCantidadInicial(nz(req.cantidadInicial()));
    p.setVendePor(req.vendePor() != null ? req.vendePor() : UnidadVenta.LITROS);
    p.setActivo(true);
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
    }
    // Los % mín/máx solo alimentan columnas sugeridas; no crean menudeo automático.
    return toDto(p, margen);
  }

  @Transactional
  public InventarioDto actualizar(Long id, ProductoRequest req) {
    Producto p = productoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    TenantGuard.assertOwned(p);
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
    if (req.vendePor() != null) {
      p.setVendePor(req.vendePor());
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
      LocalDate fecha = req.fechaVigenciaPrecio() != null
          ? req.fechaVigenciaPrecio()
          : LocalDate.now(ZONA);
      precioHistoricoService.crearDirecto(p, fecha, req.precioVenta());
    }
    return toDto(p, margen);
  }

  /**
   * Quita el producto del inventario operativo (activo=false).
   * Ventas, entradas, traspasos, preparaciones y precios históricos se conservan.
   * Solo borra de verdad si no tiene ningún historial ligado.
   */
  @Transactional
  public void eliminar(Long id) {
    Producto p = productoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    TenantGuard.assertOwned(p);
    boolean conHistorial =
        ventaRepo.countByProducto(p) > 0
            || entradaRepo.countByProducto(p) > 0
            || traspasoLineaRepo.countByProducto(p) > 0
            || produccionRepo.countByProductoResultado(p) > 0
            || produccionRepo.countByProductoInsumo(p) > 0
            || ajusteRepo.countByProducto(p) > 0
            || pedidoItemRepo.countByProducto(p) > 0;
    if (conHistorial) {
      p.setActivo(false);
      productoRepo.save(p);
      return;
    }
    precioHistoricoService.eliminarPorProducto(p);
    productoRepo.delete(p);
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

    BigDecimal stock = stockActual(p);

    BigDecimal casa = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.CASA));
    BigDecimal casaMonto = casa.multiply(compra).setScale(2, RoundingMode.HALF_UP);

    BigDecimal ganancia = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0) {
      ganancia = venta.subtract(compra).divide(venta, 4, RoundingMode.HALF_UP)
          .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
    }

    boolean bajoMinimo = venta.compareTo(BigDecimal.ZERO) > 0 && venta.compareTo(min) < 0;
    UnidadVenta vendePor = p.getVendePor() != null ? p.getVendePor() : UnidadVenta.LITROS;

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
        bajoMinimo,
        vendePor,
        vendePor.toLabel()
    );
  }

  /** Stock disponible (misma fórmula que la lista de inventario). */
  @Transactional(readOnly = true)
  public BigDecimal stockActual(Producto p) {
    BigDecimal venta = precioService.precioHoy(p);
    BigDecimal entradas = nz(entradaRepo.sumCantidadByProducto(p));
    BigDecimal producido = nz(produccionRepo.sumResultadoByProducto(p));
    BigDecimal consumidoPrep = nz(produccionRepo.sumInsumoByProducto(p));
    BigDecimal traspasos = nz(traspasoLineaRepo.sumCantidadByProducto(p));
    BigDecimal ajustes = nz(ajusteRepo.sumCantidadByProducto(p));
    BigDecimal salidasUnidades = nz(ventaRepo.sumCantidadByProductoAndTipos(
        p, List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.MUESTRA, TipoVenta.CASA, TipoVenta.MAYOREO)));
    BigDecimal pesos = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.PESOS));
    BigDecimal equivPesos = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0 && pesos.compareTo(BigDecimal.ZERO) > 0) {
      equivPesos = pesos.divide(venta, 4, RoundingMode.HALF_UP);
    }
    return nz(p.getCantidadInicial())
        .add(entradas)
        .add(producido)
        .add(ajustes)
        .subtract(consumidoPrep)
        .subtract(traspasos)
        .subtract(salidasUnidades)
        .subtract(equivPesos)
        .setScale(2, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
