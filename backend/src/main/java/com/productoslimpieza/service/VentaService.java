package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.VentaDto;
import com.productoslimpieza.web.dto.VentaLineaLoteRequest;
import com.productoslimpieza.web.dto.VentaRequest;
import com.productoslimpieza.web.dto.VentasLoteRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VentaService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final VentaRepository ventaRepo;
  private final ProductoRepository productoRepo;
  private final PrecioService precioService;
  private final CajaConfigRepository cajaConfigRepo;

  public VentaService(
      VentaRepository ventaRepo,
      ProductoRepository productoRepo,
      PrecioService precioService,
      CajaConfigRepository cajaConfigRepo) {
    this.ventaRepo = ventaRepo;
    this.productoRepo = productoRepo;
    this.precioService = precioService;
    this.cajaConfigRepo = cajaConfigRepo;
  }

  @Transactional(readOnly = true)
  public List<VentaDto> listar(LocalDate desde, LocalDate hasta) {
    List<Venta> ventas = (desde != null && hasta != null)
        ? ventaRepo.findByFechaBetweenOrderByFechaDescIdDesc(desde, hasta)
        : ventaRepo.findAllByOrderByFechaDescIdDesc();
    return ventas.stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public List<VentaDto> listarPorTipo(TipoVenta tipo) {
    return ventaRepo.findByTipoVentaOrderByFechaDescIdDesc(tipo).stream().map(this::toDto).toList();
  }

  @Transactional
  public VentaDto crear(VentaRequest req) {
    Venta v = new Venta();
    aplicar(v, req);
    return toDto(ventaRepo.save(v));
  }

  /** Una sola transacción / round-trip HTTP para muchas filas (ticket). */
  @Transactional
  public List<VentaDto> crearLote(VentasLoteRequest req) {
    if (req.lineas() == null || req.lineas().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos una venta");
    }
    validarFechaPermitida(req.fecha());

    Set<Long> ids =
        req.lineas().stream()
            .map(VentaLineaLoteRequest::productoId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    Map<Long, Producto> productos = new HashMap<>();
    if (!ids.isEmpty()) {
      for (Producto p : productoRepo.findAllById(ids)) {
        productos.put(p.getId(), p);
      }
    }

    Map<Long, BigDecimal> preciosCache = new HashMap<>();
    List<Venta> aGuardar = new ArrayList<>(req.lineas().size());
    for (VentaLineaLoteRequest linea : req.lineas()) {
      Venta v = new Venta();
      aplicarLote(v, req.fecha(), linea, productos, preciosCache);
      aGuardar.add(v);
    }
    return ventaRepo.saveAll(aGuardar).stream().map(this::toDto).toList();
  }

  @Transactional
  public VentaDto actualizar(Long id, VentaRequest req) {
    Venta v = ventaRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada"));
    aplicar(v, req);
    return toDto(ventaRepo.save(v));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!ventaRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada");
    }
    ventaRepo.deleteById(id);
  }

  private void aplicar(Venta v, VentaRequest req) {
    validarFechaPermitida(req.fecha());
    Map<Long, Producto> productos = new HashMap<>();
    Map<Long, BigDecimal> preciosCache = new HashMap<>();
    aplicarLote(
        v,
        req.fecha(),
        new VentaLineaLoteRequest(req.productoId(), req.tipoVenta(), req.cantidad(), req.total()),
        productos,
        preciosCache);
  }

  private void aplicarLote(
      Venta v,
      LocalDate fecha,
      VentaLineaLoteRequest req,
      Map<Long, Producto> productos,
      Map<Long, BigDecimal> preciosCache) {
    TipoVenta tipo = req.tipoVenta();
    Producto producto = null;
    if (tipo.esProducto()) {
      if (req.productoId() == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido");
      }
      producto = productos.get(req.productoId());
      if (producto == null) {
        producto =
            productoRepo
                .findById(req.productoId())
                .orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
        productos.put(producto.getId(), producto);
      }
      if (!producto.isActivo()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
      }
    }
    v.setFecha(fecha);
    v.setProducto(producto);
    v.setTipoVenta(tipo);
    v.setCantidad(req.cantidad());
    v.setTotal(calcularTotal(tipo, req.cantidad(), producto, fecha, req.total(), preciosCache));
  }

  public BigDecimal calcularTotal(
      TipoVenta tipo, BigDecimal cantidad, Producto producto, LocalDate fecha, BigDecimal totalManual) {
    return calcularTotal(tipo, cantidad, producto, fecha, totalManual, null);
  }

  private BigDecimal calcularTotal(
      TipoVenta tipo,
      BigDecimal cantidad,
      Producto producto,
      LocalDate fecha,
      BigDecimal totalManual,
      Map<Long, BigDecimal> preciosCache) {
    // CASA/MUESTRA normalmente $0; si hay monto manual (p. ej. Casa), se respeta.
    if (tipo.totalEsCero()) {
      if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
        return totalManual.setScale(2, RoundingMode.HALF_UP);
      }
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    if (tipo.totalEsManual()) {
      if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
        return totalManual.setScale(2, RoundingMode.HALF_UP);
      }
      if (producto == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido en mayoreo");
      }
      BigDecimal unitario = precioUnitarioMayoreo(producto, cantidad, preciosCache);
      if (unitario.compareTo(BigDecimal.ZERO) <= 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Sin precio de mayoreo; indica el total cobrado");
      }
      return cantidad.multiply(unitario).setScale(2, RoundingMode.HALF_UP);
    }
    if (tipo.totalEsCantidad()) {
      return cantidad.setScale(2, RoundingMode.HALF_UP);
    }
    if (producto == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido para este tipo de venta");
    }
    if (tipo == TipoVenta.LITROS || tipo == TipoVenta.PIEZA) {
      BigDecimal precio = precioVigenteCache(producto, fecha, preciosCache);
      return cantidad.multiply(precio).setScale(2, RoundingMode.HALF_UP);
    }
    if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
      return totalManual.setScale(2, RoundingMode.HALF_UP);
    }
    BigDecimal precio = precioVigenteCache(producto, fecha, preciosCache);
    return cantidad.multiply(precio).setScale(2, RoundingMode.HALF_UP);
  }

  private BigDecimal precioUnitarioMayoreo(
      Producto producto, BigDecimal cantidad, Map<Long, BigDecimal> preciosCache) {
    BigDecimal cant = cantidad != null ? cantidad : BigDecimal.ZERO;
    if (cant.compareTo(new BigDecimal("10")) >= 0 && producto.getPrecioMayoreo10() != null) {
      return producto.getPrecioMayoreo10();
    }
    if (cant.compareTo(new BigDecimal("5")) >= 0 && producto.getPrecioMayoreo5() != null) {
      return producto.getPrecioMayoreo5();
    }
    return precioVigenteCache(producto, LocalDate.now(ZONA), preciosCache);
  }

  private BigDecimal precioVigenteCache(
      Producto producto, LocalDate fecha, Map<Long, BigDecimal> preciosCache) {
    if (producto == null) return BigDecimal.ZERO;
    if (preciosCache != null) {
      return preciosCache.computeIfAbsent(
          producto.getId(), id -> precioService.precioVigente(producto, fecha));
    }
    return precioService.precioVigente(producto, fecha);
  }

  private void validarFechaPermitida(LocalDate fecha) {
    if (fecha == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha requerida");
    }
    LocalDate hoy = LocalDate.now(ZONA);
    if (fecha.isAfter(hoy)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "No se pueden registrar ventas con fecha futura");
    }
    LocalDate inicioPeriodo = cajaConfigRepo.findByTenantId(TenantContext.require())
        .map(CajaConfig::getFechaInicio)
        .orElse(null);
    if (inicioPeriodo != null && fecha.isBefore(inicioPeriodo)) {
      LocalDate ultimoCorte = inicioPeriodo.minusDays(1);
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No se pueden registrar ventas el " + ultimoCorte
              + " ni antes (ya hubo corte). Usa una fecha desde " + inicioPeriodo);
    }
  }

  private VentaDto toDto(Venta v) {
    Producto p = v.getProducto();
    return new VentaDto(
        v.getId(),
        v.getFecha(),
        p != null ? p.getId() : null,
        p != null ? p.getNombre() : null,
        v.getTipoVenta(),
        v.getTipoVenta().toLabel(),
        v.getCantidad(),
        v.getTotal()
    );
  }
}
