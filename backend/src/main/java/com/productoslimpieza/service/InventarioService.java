package com.productoslimpieza.service;

import com.productoslimpieza.domain.DepartamentoProducto;
import com.productoslimpieza.domain.MargenConfig;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.repo.AjusteInventarioRepository;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.PedidoItemRepository;
import com.productoslimpieza.repo.PrecioHistoricoRepository;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventarioService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private static final List<TipoVenta> TIPOS_SALIDA_UNIDADES =
      List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.MUESTRA, TipoVenta.CASA, TipoVenta.MAYOREO);

  private final ProductoRepository productoRepo;
  private final EntradaRepository entradaRepo;
  private final VentaRepository ventaRepo;
  private final ProduccionRepository produccionRepo;
  private final TraspasoLineaRepository traspasoLineaRepo;
  private final AjusteInventarioRepository ajusteRepo;
  private final PedidoItemRepository pedidoItemRepo;
  private final PrecioHistoricoRepository precioHistoricoRepo;
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
      PrecioHistoricoRepository precioHistoricoRepo,
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
    this.precioHistoricoRepo = precioHistoricoRepo;
    this.precioService = precioService;
    this.precioHistoricoService = precioHistoricoService;
    this.margenService = margenService;
  }

  @Transactional(readOnly = true)
  public List<InventarioDto> listar() {
    MargenConfig margen = margenService.getConfig();
    List<Producto> productos = productoRepo.findByActivoTrueOrderByNombreAsc();
    if (productos.isEmpty()) {
      return List.of();
    }

    LocalDate hoy = LocalDate.now(ZONA);
    Map<Long, BigDecimal> precios = toMap(precioHistoricoRepo.findPreciosVigentesGroupByProducto(hoy));
    Map<Long, BigDecimal> entradas = toMap(entradaRepo.sumCantidadGroupByProducto());
    Map<Long, BigDecimal> producido = toMap(produccionRepo.sumResultadoGroupByProducto());
    Map<Long, BigDecimal> consumidoLineas = toMap(produccionRepo.sumInsumoLineasGroupByProducto());
    Map<Long, BigDecimal> consumidoLegacy = toMap(produccionRepo.sumInsumoLegacyGroupByProducto());
    Map<Long, BigDecimal> traspasos = toMap(traspasoLineaRepo.sumCantidadGroupByProducto());
    Map<Long, BigDecimal> ajustes = toMap(ajusteRepo.sumCantidadGroupByProducto());
    Map<Long, BigDecimal> salidas = toMap(ventaRepo.sumCantidadGroupByProductoAndTipos(TIPOS_SALIDA_UNIDADES));
    Map<Long, BigDecimal> pesos = toMap(ventaRepo.sumCantidadGroupByProductoAndTipo(TipoVenta.PESOS));
    Map<Long, BigDecimal> casa = toMap(ventaRepo.sumCantidadGroupByProductoAndTipo(TipoVenta.CASA));

    return productos.stream()
        .map(
            p ->
                toDtoBulk(
                    p,
                    margen,
                    precios,
                    entradas,
                    producido,
                    consumidoLineas,
                    consumidoLegacy,
                    traspasos,
                    ajustes,
                    salidas,
                    pesos,
                    casa))
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
      previo.setDepartamento(resolverDepartamento(req, previo.getVendePor(), nombre));
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
    UnidadVenta vendePor = req.vendePor() != null ? req.vendePor() : UnidadVenta.LITROS;
    p.setVendePor(vendePor);
    p.setDepartamento(resolverDepartamento(req, vendePor, nombre));
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
    if (req.departamento() != null) {
      p.setDepartamento(req.departamento());
    }
    // Precios mayoreo manuales; si no vienen y cambió compra, recalcular desde márgenes
    if (req.precioMayoreo5() != null || req.precioMayoreo10() != null) {
      if (req.precioMayoreo5() != null) {
        p.setPrecioMayoreo5(pesoEntero(req.precioMayoreo5()));
      }
      if (req.precioMayoreo10() != null) {
        p.setPrecioMayoreo10(pesoEntero(req.precioMayoreo10()));
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
    p.setPrecioMayoreo5(conMargenEntero(compra, margen.getMargenMayoreo5()));
    p.setPrecioMayoreo10(conMargenEntero(compra, margen.getMargenMayoreo10()));
  }

  private static BigDecimal conMargen(BigDecimal compra, BigDecimal margen) {
    return compra.multiply(BigDecimal.ONE.add(nz(margen))).setScale(2, RoundingMode.HALF_UP);
  }

  /** Mayoreo (≥5 / ≥10) se cobra en efectivo: pesos enteros, sin centavos. */
  private static BigDecimal conMargenEntero(BigDecimal compra, BigDecimal margen) {
    return pesoEntero(compra.multiply(BigDecimal.ONE.add(nz(margen))));
  }

  private static BigDecimal pesoEntero(BigDecimal valor) {
    if (valor == null) return null;
    return valor.setScale(0, RoundingMode.HALF_UP);
  }

  private InventarioDto toDto(Producto p, MargenConfig margen) {
    BigDecimal venta = precioService.precioHoy(p);
    BigDecimal stock = stockActual(p);
    BigDecimal casa = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.CASA));
    return toDtoValues(p, margen, venta, stock, casa);
  }

  private InventarioDto toDtoBulk(
      Producto p,
      MargenConfig margen,
      Map<Long, BigDecimal> precios,
      Map<Long, BigDecimal> entradas,
      Map<Long, BigDecimal> producido,
      Map<Long, BigDecimal> consumidoLineas,
      Map<Long, BigDecimal> consumidoLegacy,
      Map<Long, BigDecimal> traspasos,
      Map<Long, BigDecimal> ajustes,
      Map<Long, BigDecimal> salidas,
      Map<Long, BigDecimal> pesos,
      Map<Long, BigDecimal> casaMap) {
    Long id = p.getId();
    BigDecimal venta = precios.getOrDefault(id, BigDecimal.ZERO);
    BigDecimal consumidoPrep =
        consumidoLineas.getOrDefault(id, BigDecimal.ZERO).add(consumidoLegacy.getOrDefault(id, BigDecimal.ZERO));
    BigDecimal pesosAmt = pesos.getOrDefault(id, BigDecimal.ZERO);
    BigDecimal equivPesos = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0 && pesosAmt.compareTo(BigDecimal.ZERO) > 0) {
      equivPesos = pesosAmt.divide(venta, 4, RoundingMode.HALF_UP);
    }
    BigDecimal stock =
        nz(p.getCantidadInicial())
            .add(entradas.getOrDefault(id, BigDecimal.ZERO))
            .add(producido.getOrDefault(id, BigDecimal.ZERO))
            .add(ajustes.getOrDefault(id, BigDecimal.ZERO))
            .subtract(consumidoPrep)
            .subtract(traspasos.getOrDefault(id, BigDecimal.ZERO))
            .subtract(salidas.getOrDefault(id, BigDecimal.ZERO))
            .subtract(equivPesos)
            .setScale(2, RoundingMode.HALF_UP);
    return toDtoValues(p, margen, venta, stock, casaMap.getOrDefault(id, BigDecimal.ZERO));
  }

  private InventarioDto toDtoValues(
      Producto p, MargenConfig margen, BigDecimal venta, BigDecimal stock, BigDecimal casa) {
    BigDecimal compra = nz(p.getPrecioCompra());
    BigDecimal margenMin = nz(margen.getMargenMin());
    BigDecimal margenMax = nz(margen.getMargenMax());
    BigDecimal min = conMargenEntero(compra, margenMin);
    BigDecimal max = conMargenEntero(compra, margenMax);
    BigDecimal mayoreo5 =
        pesoEntero(
            p.getPrecioMayoreo5() != null
                ? p.getPrecioMayoreo5()
                : conMargen(compra, margen.getMargenMayoreo5()));
    BigDecimal mayoreo10 =
        pesoEntero(
            p.getPrecioMayoreo10() != null
                ? p.getPrecioMayoreo10()
                : conMargen(compra, margen.getMargenMayoreo10()));

    BigDecimal casaMonto = nz(casa).multiply(compra).setScale(2, RoundingMode.HALF_UP);

    BigDecimal ganancia = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0) {
      ganancia =
          venta
              .subtract(compra)
              .divide(venta, 4, RoundingMode.HALF_UP)
              .multiply(new BigDecimal("100"))
              .setScale(2, RoundingMode.HALF_UP);
    }

    boolean bajoMinimo = venta.compareTo(BigDecimal.ZERO) > 0 && venta.compareTo(min) < 0;
    boolean enMinimo = venta.compareTo(BigDecimal.ZERO) > 0 && venta.compareTo(min) == 0;
    UnidadVenta vendePor = p.getVendePor() != null ? p.getVendePor() : UnidadVenta.LITROS;
    DepartamentoProducto depto =
        p.getDepartamento() != null
            ? p.getDepartamento()
            : DepartamentoProducto.inferir(vendePor, p.getNombre());

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
        nz(casa),
        casaMonto,
        ganancia,
        bajoMinimo,
        enMinimo,
        vendePor,
        vendePor.toLabel(),
        depto,
        depto.toLabel());
  }

  private static Map<Long, BigDecimal> toMap(List<Object[]> rows) {
    Map<Long, BigDecimal> map = new HashMap<>();
    if (rows == null) return map;
    for (Object[] row : rows) {
      if (row == null || row.length < 2 || row[0] == null) continue;
      Long id = ((Number) row[0]).longValue();
      BigDecimal val = row[1] instanceof BigDecimal bd ? bd : nz(row[1] == null ? null : new BigDecimal(row[1].toString()));
      map.put(id, val);
    }
    return map;
  }

  /** Stock disponible (misma fórmula que la lista de inventario). */
  @Transactional(readOnly = true)
  public BigDecimal stockActual(Producto p) {
    BigDecimal venta = precioService.precioHoy(p);
    BigDecimal entradas = nz(entradaRepo.sumCantidadByProducto(p));
    BigDecimal producido = nz(produccionRepo.sumResultadoByProducto(p));
    BigDecimal consumidoPrep =
        nz(produccionRepo.sumInsumoLineasByProducto(p))
            .add(nz(produccionRepo.sumInsumoLegacyByProducto(p)));
    BigDecimal traspasos = nz(traspasoLineaRepo.sumCantidadByProducto(p));
    BigDecimal ajustes = nz(ajusteRepo.sumCantidadByProducto(p));
    BigDecimal salidasUnidades =
        nz(ventaRepo.sumCantidadByProductoAndTipos(p, TIPOS_SALIDA_UNIDADES));
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

  private static DepartamentoProducto resolverDepartamento(
      ProductoRequest req, UnidadVenta vendePor, String nombre) {
    if (req.departamento() != null) {
      return req.departamento();
    }
    return DepartamentoProducto.inferir(vendePor, nombre);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
