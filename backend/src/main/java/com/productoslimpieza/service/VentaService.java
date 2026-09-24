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

  @Transactional
  public List<VentaDto> listar(LocalDate desde, LocalDate hasta) {
    asignarFoliosFaltantes();
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
    v.setFolio(siguienteFolioDelDia(req.fecha()));
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
    Long folio = siguienteFolioDelDia(req.fecha());
    List<Venta> aGuardar = new ArrayList<>(req.lineas().size());
    for (VentaLineaLoteRequest linea : req.lineas()) {
      Venta v = new Venta();
      aplicarLote(v, req.fecha(), linea, productos, preciosCache);
      v.setFolio(folio);
      aGuardar.add(v);
    }
    return ventaRepo.saveAll(aGuardar).stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public List<VentaDto> listarPorFolio(Long folio, LocalDate fecha) {
    if (folio == null || folio <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio inválido");
    }
    LocalDate dia = fecha != null ? fecha : LocalDate.now(ZONA);
    List<VentaDto> list =
        ventaRepo.findByFolioAndFechaOrderByIdAsc(folio, dia).stream().map(this::toDto).toList();
    if (list.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "No hay ventas con folio " + folio + " del " + dia);
    }
    return list;
  }

  /** Folio del día: 1, 2, 3… reinicia cada fecha de venta. */
  private Long siguienteFolioDelDia(LocalDate fecha) {
    LocalDate dia = fecha != null ? fecha : LocalDate.now(ZONA);
    Long max = ventaRepo.maxFolioDelDia(TenantContext.require(), dia);
    long base = max != null ? max : 0L;
    return base + 1L;
  }

  /** Asigna folio a ventas viejas sin folio (una por línea, por fecha). */
  private void asignarFoliosFaltantes() {
    List<Venta> sin = ventaRepo.findByFolioIsNullOrderByFechaAscIdAsc();
    if (sin.isEmpty()) {
      return;
    }
    LocalDate cur = null;
    long next = 1L;
    String tenant = TenantContext.require();
    for (Venta v : sin) {
      LocalDate f = v.getFecha();
      if (cur == null || !cur.equals(f)) {
        cur = f;
        Long max = ventaRepo.maxFolioDelDia(tenant, cur);
        next = (max != null ? max : 0L) + 1L;
      }
      v.setFolio(next++);
    }
    ventaRepo.saveAll(sin);
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
        new VentaLineaLoteRequest(
            req.productoId(), req.tipoVenta(), req.cantidad(), req.total(), req.pagoTarjeta()),
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
    boolean tarjeta = Boolean.TRUE.equals(req.pagoTarjeta()) && !tipo.totalEsCero();
    v.setPagoTarjeta(tarjeta);
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
    // CASA/MUESTRA normalmente $0; si hay monto manual (p. ej. Casa), cobro en pesos/.50.
    if (tipo.totalEsCero()) {
      if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
        return pesoCobroCliente(totalManual);
      }
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    if (tipo.totalEsManual()) {
      if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
        return pesoCobroCliente(totalManual);
      }
      if (producto == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido en mayoreo");
      }
      BigDecimal unitario = precioUnitarioMayoreo(producto, cantidad, preciosCache);
      if (unitario.compareTo(BigDecimal.ZERO) <= 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Sin precio de mayoreo; indica el total cobrado");
      }
      return pesoCobroCliente(cantidad.multiply(unitario));
    }
    if (tipo.totalEsCantidad()) {
      // PESOS: la cantidad es el cobro
      return pesoCobroCliente(cantidad);
    }
    if (producto == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido para este tipo de venta");
    }
    if (tipo == TipoVenta.LITROS || tipo == TipoVenta.PIEZA) {
      BigDecimal precio = precioVigenteCache(producto, fecha, preciosCache);
      return pesoCobroCliente(cantidad.multiply(precio));
    }
    if (totalManual != null && totalManual.compareTo(BigDecimal.ZERO) > 0) {
      return pesoCobroCliente(totalManual);
    }
    BigDecimal precio = precioVigenteCache(producto, fecha, preciosCache);
    return pesoCobroCliente(cantidad.multiply(precio));
  }

  private BigDecimal precioUnitarioMayoreo(
      Producto producto, BigDecimal cantidad, Map<Long, BigDecimal> preciosCache) {
    BigDecimal cant = cantidad != null ? cantidad : BigDecimal.ZERO;
    if (cant.compareTo(new BigDecimal("10")) >= 0 && producto.getPrecioMayoreo10() != null) {
      return pesoCobroCliente(producto.getPrecioMayoreo10());
    }
    if (cant.compareTo(new BigDecimal("5")) >= 0 && producto.getPrecioMayoreo5() != null) {
      return pesoCobroCliente(producto.getPrecioMayoreo5());
    }
    return precioVigenteCache(producto, LocalDate.now(ZONA), preciosCache);
  }

  /**
   * Cobro al cliente: solo pesos enteros o .50 (sin otros centavos).
   * Fracción 0 → entero; &lt; .50 → X.50; = .50 → X.50; &gt; .50 → X+1.
   * Ej.: 13.10→13.50, 13.50→13.50, 13.80→14.
   */
  private static BigDecimal pesoCobroCliente(BigDecimal valor) {
    if (valor == null) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    BigDecimal v = valor.setScale(2, RoundingMode.HALF_UP);
    BigDecimal entero = v.setScale(0, RoundingMode.FLOOR);
    BigDecimal frac = v.subtract(entero);
    if (frac.compareTo(BigDecimal.ZERO) == 0) {
      return entero.setScale(2, RoundingMode.HALF_UP);
    }
    BigDecimal medio = new BigDecimal("0.50");
    if (frac.compareTo(medio) <= 0) {
      return entero.add(medio).setScale(2, RoundingMode.HALF_UP);
    }
    return entero.add(BigDecimal.ONE).setScale(2, RoundingMode.HALF_UP);
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
        v.getTotal(),
        v.isPagoTarjeta(),
        v.getFolio()
    );
  }
}
