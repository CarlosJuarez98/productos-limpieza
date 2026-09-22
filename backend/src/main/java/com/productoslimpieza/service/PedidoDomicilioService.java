package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.EstadoPedidoDomicilio;
import com.productoslimpieza.domain.PedidoDomicilio;
import com.productoslimpieza.domain.PedidoDomicilioItem;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.PedidoDomicilioRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.PedidoDomicilioDto;
import com.productoslimpieza.web.dto.PedidoDomicilioEntregarRequest;
import com.productoslimpieza.web.dto.PedidoDomicilioItemRequest;
import com.productoslimpieza.web.dto.PedidoDomicilioRequest;
import com.productoslimpieza.web.dto.VentaDto;
import com.productoslimpieza.web.dto.VentaLineaLoteRequest;
import com.productoslimpieza.web.dto.VentasLoteRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
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
public class PedidoDomicilioService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final PedidoDomicilioRepository repo;
  private final ProductoRepository productoRepo;
  private final VentaRepository ventaRepo;
  private final VentaService ventaService;
  private final CajaConfigRepository cajaConfigRepo;

  public PedidoDomicilioService(
      PedidoDomicilioRepository repo,
      ProductoRepository productoRepo,
      VentaRepository ventaRepo,
      VentaService ventaService,
      CajaConfigRepository cajaConfigRepo) {
    this.repo = repo;
    this.productoRepo = productoRepo;
    this.ventaRepo = ventaRepo;
    this.ventaService = ventaService;
    this.cajaConfigRepo = cajaConfigRepo;
  }

  @Transactional(readOnly = true)
  public List<PedidoDomicilioDto> listar() {
    return repo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public List<PedidoDomicilioDto> listarPendientes() {
    return repo.findByEstadoOrderByFechaDescIdDesc(EstadoPedidoDomicilio.PENDIENTE).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public PedidoDomicilioDto obtener(Long id) {
    return toDto(require(id));
  }

  @Transactional
  public PedidoDomicilioDto crear(PedidoDomicilioRequest req) {
    PedidoDomicilio p = new PedidoDomicilio();
    aplicarCabecera(p, req);
    p.setEstado(EstadoPedidoDomicilio.PENDIENTE);
    reemplazarItems(p, req.lineas(), req.fecha());
    return toDto(repo.save(p));
  }

  @Transactional
  public PedidoDomicilioDto actualizar(Long id, PedidoDomicilioRequest req) {
    PedidoDomicilio p = require(id);
    if (p.getEstado() == EstadoPedidoDomicilio.CANCELADA) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "No se puede editar un pedido cancelado");
    }
    boolean eraEntregada = p.getEstado() == EstadoPedidoDomicilio.ENTREGADA;
    if (eraEntregada) {
      borrarVentasLigadas(p);
    }
    aplicarCabecera(p, req);
    reemplazarItems(p, req.lineas(), req.fecha());
    if (eraEntregada) {
      LocalDate fechaVenta =
          p.getFechaEntrega() != null ? p.getFechaEntrega() : LocalDate.now(ZONA);
      registrarVentasEntrega(p, fechaVenta, null);
      p.setFechaEntrega(fechaVenta);
      p.setEstado(EstadoPedidoDomicilio.ENTREGADA);
    }
    return toDto(repo.save(p));
  }

  @Transactional
  public PedidoDomicilioDto entregar(Long id, PedidoDomicilioEntregarRequest req) {
    PedidoDomicilio p = require(id);
    exigirPendiente(p);
    if (p.getItems().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido no tiene productos");
    }
    LocalDate fechaVenta =
        req != null && req.fecha() != null ? req.fecha() : LocalDate.now(ZONA);
    if (fechaVenta.isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "La fecha de entrega no puede ser futura");
    }
    Boolean pagoPedido = req != null ? req.pagoTarjeta() : null;
    registrarVentasEntrega(p, fechaVenta, pagoPedido);
    p.setEstado(EstadoPedidoDomicilio.ENTREGADA);
    p.setFechaEntrega(fechaVenta);
    return toDto(repo.save(p));
  }

  @Transactional
  public PedidoDomicilioDto cancelar(Long id) {
    PedidoDomicilio p = require(id);
    exigirPendiente(p);
    p.setEstado(EstadoPedidoDomicilio.CANCELADA);
    return toDto(repo.save(p));
  }

  @Transactional
  public void eliminar(Long id) {
    PedidoDomicilio p = require(id);
    if (p.getEstado() == EstadoPedidoDomicilio.ENTREGADA) {
      borrarVentasLigadas(p);
    }
    repo.delete(p);
  }

  private void registrarVentasEntrega(PedidoDomicilio p, LocalDate fechaVenta, Boolean pagoPedido) {
    List<VentaLineaLoteRequest> lineas = new ArrayList<>(p.getItems().size());
    for (PedidoDomicilioItem it : p.getItems()) {
      boolean lineaTarjeta =
          pagoPedido != null ? Boolean.TRUE.equals(pagoPedido) : it.isPagoTarjeta();
      lineas.add(
          new VentaLineaLoteRequest(
              it.getProducto() != null ? it.getProducto().getId() : null,
              it.getTipoVenta(),
              it.getCantidad(),
              it.getTotal(),
              lineaTarjeta));
    }
    List<VentaDto> ventas = ventaService.crearLote(new VentasLoteRequest(fechaVenta, lineas));
    if (ventas.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "No se pudieron registrar las ventas");
    }
    p.setVentaIds(ventas.stream().map(VentaDto::id).collect(Collectors.toCollection(ArrayList::new)));
  }

  private void borrarVentasLigadas(PedidoDomicilio p) {
    List<Long> ids = new ArrayList<>(p.getVentaIds() != null ? p.getVentaIds() : List.of());
    if (ids.isEmpty()) {
      ids.addAll(resolverVentasLegado(p));
    }
    for (Long ventaId : ids) {
      if (ventaId != null && ventaRepo.existsById(ventaId)) {
        ventaService.eliminar(ventaId);
      }
    }
    p.setVentaIds(new ArrayList<>());
  }

  /** Pedidos entregados antes de guardar ventaIds: intenta emparejar por fecha + líneas. */
  private List<Long> resolverVentasLegado(PedidoDomicilio p) {
    LocalDate fecha = p.getFechaEntrega() != null ? p.getFechaEntrega() : p.getFecha();
    if (fecha == null || p.getItems().isEmpty()) return List.of();
    List<Venta> candidatas = ventaRepo.findByFechaBetweenOrderByFechaDescIdDesc(fecha, fecha);
    Set<Long> usados = new HashSet<>();
    List<Long> hallados = new ArrayList<>();
    for (PedidoDomicilioItem it : p.getItems()) {
      for (Venta v : candidatas) {
        if (usados.contains(v.getId())) continue;
        if (!mismoDetalle(it, v)) continue;
        usados.add(v.getId());
        hallados.add(v.getId());
        break;
      }
    }
    return hallados;
  }

  private static boolean mismoDetalle(PedidoDomicilioItem it, Venta v) {
    if (it.getTipoVenta() != v.getTipoVenta()) return false;
    if (it.isPagoTarjeta() != v.isPagoTarjeta()) return false;
    Long prodIt = it.getProducto() != null ? it.getProducto().getId() : null;
    Long prodV = v.getProducto() != null ? v.getProducto().getId() : null;
    if (!Objects.equals(prodIt, prodV)) return false;
    if (nz(it.getCantidad()).compareTo(nz(v.getCantidad())) != 0) return false;
    return nz(it.getTotal()).compareTo(nz(v.getTotal())) == 0;
  }

  private static BigDecimal nz(BigDecimal v) {
    return v != null ? v.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2);
  }

  private void aplicarCabecera(PedidoDomicilio p, PedidoDomicilioRequest req) {
    if (req.fecha() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica la fecha");
    }
    validarFechaPedido(req.fecha());
    p.setFecha(req.fecha());
    p.setCliente(blankToNull(req.cliente()));
    p.setTelefono(normalizarTel(req.telefono()));
    p.setNota(blankToNull(req.nota()));
  }

  /**
   * Pedidos a domicilio sí admiten fecha futura (programar entrega).
   * No admiten fechas del último corte ni anteriores.
   */
  private void validarFechaPedido(LocalDate fecha) {
    LocalDate inicioPeriodo =
        cajaConfigRepo
            .findByTenantId(TenantContext.require())
            .map(CajaConfig::getFechaInicio)
            .orElse(null);
    if (inicioPeriodo != null && fecha.isBefore(inicioPeriodo)) {
      LocalDate ultimoCorte = inicioPeriodo.minusDays(1);
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No se pueden registrar el "
              + ultimoCorte
              + " ni antes (ya hubo corte). Usa una fecha desde "
              + inicioPeriodo);
    }
  }

  private void reemplazarItems(
      PedidoDomicilio p, List<PedidoDomicilioItemRequest> lineas, LocalDate fecha) {
    if (lineas == null || lineas.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un producto");
    }
    Set<Long> ids =
        lineas.stream()
            .map(PedidoDomicilioItemRequest::productoId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    Map<Long, Producto> productos = new HashMap<>();
    if (!ids.isEmpty()) {
      for (Producto prod : productoRepo.findAllById(ids)) {
        productos.put(prod.getId(), prod);
      }
    }
    p.clearItems();
    for (PedidoDomicilioItemRequest linea : lineas) {
      TipoVenta tipo = linea.tipoVenta();
      if (tipo == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta el tipo de venta");
      }
      if (linea.cantidad() == null || linea.cantidad().compareTo(BigDecimal.ZERO) <= 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cantidad debe ser mayor a 0");
      }
      Producto producto = null;
      if (tipo.esProducto()) {
        if (linea.productoId() == null) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido");
        }
        producto = productos.get(linea.productoId());
        if (producto == null) {
          producto =
              productoRepo
                  .findById(linea.productoId())
                  .orElseThrow(
                      () ->
                          new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
          productos.put(producto.getId(), producto);
        }
        if (!producto.isActivo()) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST, "El producto está dado de baja: " + producto.getNombre());
        }
      }
      BigDecimal total =
          ventaService.calcularTotal(tipo, linea.cantidad(), producto, fecha, linea.total());
      PedidoDomicilioItem item = new PedidoDomicilioItem();
      item.setProducto(producto);
      item.setTipoVenta(tipo);
      item.setCantidad(linea.cantidad().setScale(4, RoundingMode.HALF_UP));
      item.setTotal(total);
      item.setPagoTarjeta(Boolean.TRUE.equals(linea.pagoTarjeta()) && !tipo.totalEsCero());
      item.setTenantId(TenantContext.require());
      p.addItem(item);
    }
  }

  private PedidoDomicilio require(Long id) {
    return repo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
  }

  private static void exigirPendiente(PedidoDomicilio p) {
    if (p.getEstado() != EstadoPedidoDomicilio.PENDIENTE) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Solo se puede modificar un pedido pendiente");
    }
  }

  private PedidoDomicilioDto toDto(PedidoDomicilio p) {
    List<PedidoDomicilioDto.Item> items =
        p.getItems().stream()
            .map(
                i ->
                    new PedidoDomicilioDto.Item(
                        i.getId(),
                        i.getProducto() != null ? i.getProducto().getId() : null,
                        i.getProducto() != null ? i.getProducto().getNombre() : null,
                        i.getTipoVenta(),
                        i.getTipoVenta() != null ? i.getTipoVenta().toLabel() : "",
                        i.getCantidad(),
                        i.getTotal(),
                        i.isPagoTarjeta()))
            .toList();
    BigDecimal total =
        items.stream()
            .map(PedidoDomicilioDto.Item::total)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    return new PedidoDomicilioDto(
        p.getId(),
        p.getFecha(),
        p.getEstado(),
        p.getCliente(),
        p.getTelefono(),
        p.getNota(),
        p.getFechaEntrega(),
        total,
        items);
  }

  private static String blankToNull(String s) {
    if (s == null) return null;
    String t = s.trim();
    return t.isEmpty() ? null : t;
  }

  private static String normalizarTel(String s) {
    String t = blankToNull(s);
    if (t == null) return null;
    return t.replaceAll("[^0-9+]", "");
  }
}
