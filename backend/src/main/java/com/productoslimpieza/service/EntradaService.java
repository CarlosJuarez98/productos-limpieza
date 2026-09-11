package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.Pedido;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.EntradaDto;
import com.productoslimpieza.web.dto.EntradaLineaRequest;
import com.productoslimpieza.web.dto.EntradaRequest;
import com.productoslimpieza.web.dto.EntradasLoteRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EntradaService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final EntradaRepository entradaRepo;
  private final ProductoRepository productoRepo;
  private final CajaConfigRepository cajaConfigRepo;
  private final PedidoRegistroService pedidoRegistroService;

  public EntradaService(
      EntradaRepository entradaRepo,
      ProductoRepository productoRepo,
      CajaConfigRepository cajaConfigRepo,
      PedidoRegistroService pedidoRegistroService) {
    this.entradaRepo = entradaRepo;
    this.productoRepo = productoRepo;
    this.cajaConfigRepo = cajaConfigRepo;
    this.pedidoRegistroService = pedidoRegistroService;
  }

  @Transactional(readOnly = true)
  public List<EntradaDto> listar() {
    List<Entrada> desc = entradaRepo.findAllByOrderByFechaDescIdDesc();
    Map<Long, BigDecimal> anteriorPorId = preciosAnterioresPorCompra(desc);
    return desc.stream().map(e -> toDto(e, anteriorPorId.get(e.getId()))).toList();
  }

  @Transactional
  public EntradaDto crear(EntradaRequest req) {
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    exigirActivo(producto);
    exigirNoEsPreparacion(producto);
    BigDecimal anterior = ultimaCompraProducto(producto.getId());
    Entrada e = new Entrada();
    aplicar(e, req.fecha(), producto, req.cantidad(), req.precioProveedor());
    ligarPedido(e, producto.getId(), req.aplicarAPedido(), req.pedidoId());
    Entrada saved = entradaRepo.save(e);
    actualizarPrecioCompraSiCambio(producto, req.precioProveedor());
    if (saved.getPedido() != null) {
      pedidoRegistroService.recalcularRecibidoDesdeEntradas(saved.getPedido().getId());
    }
    return toDto(saved, anterior);
  }

  @Transactional
  public List<EntradaDto> crearLote(EntradasLoteRequest req) {
    if (req.lineas() == null || req.lineas().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un producto");
    }
    Set<Long> ids =
        req.lineas().stream().map(EntradaLineaRequest::productoId).collect(Collectors.toSet());
    Map<Long, Producto> productos = new HashMap<>();
    for (Producto p : productoRepo.findAllById(ids)) {
      productos.put(p.getId(), p);
    }

    List<EntradaDto> out = new ArrayList<>();
    Map<Long, BigDecimal> ultimaEnLote = new HashMap<>();
    Set<Long> pedidosTocados = new HashSet<>();
    List<Entrada> aGuardar = new ArrayList<>(req.lineas().size());
    List<BigDecimal> anteriores = new ArrayList<>(req.lineas().size());
    List<Producto> prodsLinea = new ArrayList<>(req.lineas().size());
    List<BigDecimal> preciosLinea = new ArrayList<>(req.lineas().size());

    for (EntradaLineaRequest linea : req.lineas()) {
      Producto producto = productos.get(linea.productoId());
      if (producto == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado");
      }
      exigirActivo(producto);
      exigirNoEsPreparacion(producto);
      BigDecimal anterior =
          ultimaEnLote.containsKey(producto.getId())
              ? ultimaEnLote.get(producto.getId())
              : ultimaCompraProducto(producto.getId());
      Entrada e = new Entrada();
      aplicar(e, req.fecha(), producto, linea.cantidad(), linea.precioProveedor());
      ligarPedido(e, producto.getId(), linea.aplicarAPedido(), linea.pedidoId());
      aGuardar.add(e);
      anteriores.add(anterior);
      prodsLinea.add(producto);
      preciosLinea.add(linea.precioProveedor());
      if (linea.precioProveedor() != null) {
        ultimaEnLote.put(producto.getId(), linea.precioProveedor());
      }
    }

    List<Entrada> saved = entradaRepo.saveAll(aGuardar);
    for (int i = 0; i < saved.size(); i++) {
      Entrada e = saved.get(i);
      if (e.getPedido() != null) {
        pedidosTocados.add(e.getPedido().getId());
      }
      actualizarPrecioCompraSiCambio(prodsLinea.get(i), preciosLinea.get(i));
      out.add(toDto(e, anteriores.get(i)));
    }
    for (Long pid : pedidosTocados) {
      pedidoRegistroService.recalcularRecibidoDesdeEntradas(pid);
    }
    return out;
  }

  @Transactional
  public EntradaDto actualizar(Long id, EntradaRequest req) {
    Entrada e = entradaRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada"));
    Long pedidoAntes = e.getPedido() != null ? e.getPedido().getId() : null;
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    exigirActivo(producto);
    exigirNoEsPreparacion(producto);
    aplicar(e, req.fecha(), producto, req.cantidad(), req.precioProveedor());
    ligarPedido(e, producto.getId(), req.aplicarAPedido(), req.pedidoId());
    Entrada saved = entradaRepo.save(e);
    actualizarPrecioCompraSiCambio(producto, req.precioProveedor());
    Long pedidoDespues = saved.getPedido() != null ? saved.getPedido().getId() : null;
    if (pedidoAntes != null) {
      pedidoRegistroService.recalcularRecibidoDesdeEntradas(pedidoAntes);
    }
    if (pedidoDespues != null && !pedidoDespues.equals(pedidoAntes)) {
      pedidoRegistroService.recalcularRecibidoDesdeEntradas(pedidoDespues);
    }
    BigDecimal anterior = ultimaCompraAntesDe(saved);
    return toDto(saved, anterior);
  }

  @Transactional
  public void eliminar(Long id) {
    Entrada e = entradaRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada"));
    Long pedidoId = e.getPedido() != null ? e.getPedido().getId() : null;
    entradaRepo.delete(e);
    if (pedidoId != null) {
      pedidoRegistroService.recalcularRecibidoDesdeEntradas(pedidoId);
    }
  }

  private void ligarPedido(Entrada e, Long productoId, Boolean aplicarAPedido, Long pedidoId) {
    if (Boolean.FALSE.equals(aplicarAPedido)) {
      e.setPedido(null);
      return;
    }
    if (pedidoId != null) {
      Pedido pedido = pedidoRegistroService.pedidoParaEntrada(productoId, pedidoId)
          .orElseThrow(() -> new ResponseStatusException(
              HttpStatus.BAD_REQUEST,
              "Ese pedido no incluye el producto o ya está cerrado"));
      e.setPedido(pedido);
      return;
    }
    // Sin pedidoId: conservar vínculo existente si sigue válido
    if (e.getPedido() != null) {
      Long existingId = e.getPedido().getId();
      Optional<Pedido> kept = pedidoRegistroService.pedidoParaEntrada(productoId, existingId);
      if (kept.isPresent()) {
        e.setPedido(kept.get());
        return;
      }
    }
    if (Boolean.TRUE.equals(aplicarAPedido)) {
      e.setPedido(pedidoRegistroService.resolverPedidoParaProducto(productoId, null).orElse(null));
      return;
    }
    e.setPedido(null);
  }

  private void exigirActivo(Producto producto) {
    if (!producto.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
  }

  /** Cloro y Fabuloso* se producen; no se compran al proveedor. */
  private void exigirNoEsPreparacion(Producto producto) {
    String n = producto.getNombre() == null ? "" : producto.getNombre().trim().toLowerCase();
    if ("cloro".equals(n) || "fabuloso".equals(n) || n.startsWith("fabuloso ")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "«" + producto.getNombre()
              + "» se obtiene por preparación (Hipoclorito / Base Fabuloso), no por entrada de proveedor");
    }
  }

  private void actualizarPrecioCompraSiCambio(Producto producto, BigDecimal precioProveedor) {
    if (precioProveedor == null) {
      return;
    }
    BigDecimal actual = producto.getPrecioCompra();
    if (actual != null && actual.compareTo(precioProveedor) == 0) {
      return;
    }
    producto.setPrecioCompra(precioProveedor);
    productoRepo.save(producto);
  }

  private void aplicar(
      Entrada e,
      java.time.LocalDate fecha,
      Producto producto,
      BigDecimal cantidad,
      BigDecimal precioProveedor) {
    validarFechaPermitida(fecha);
    e.setFecha(fecha);
    e.setProducto(producto);
    e.setCantidad(cantidad);
    e.setPrecioProveedor(precioProveedor);
    if (precioProveedor != null) {
      e.setTotal(cantidad.multiply(precioProveedor).setScale(2, RoundingMode.HALF_UP));
    } else {
      e.setTotal(null);
    }
  }

  private void validarFechaPermitida(LocalDate fecha) {
    if (fecha == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha requerida");
    }
    LocalDate hoy = LocalDate.now(ZONA);
    if (fecha.isAfter(hoy)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "No se permiten fechas futuras");
    }
    LocalDate inicioPeriodo = cajaConfigRepo.findByTenantId(TenantContext.require())
        .map(CajaConfig::getFechaInicio)
        .orElse(null);
    if (inicioPeriodo != null && fecha.isBefore(inicioPeriodo)) {
      LocalDate ultimoCorte = inicioPeriodo.minusDays(1);
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No se pueden registrar entradas el " + ultimoCorte
              + " ni antes (ya hubo corte). Usa una fecha desde " + inicioPeriodo);
    }
  }

  private Map<Long, BigDecimal> preciosAnterioresPorCompra(List<Entrada> desc) {
    Map<Long, BigDecimal> anteriorPorId = new HashMap<>();
    Map<Long, BigDecimal> ultimoPorProducto = new HashMap<>();
    List<Entrada> asc = new ArrayList<>(desc);
    Collections.reverse(asc);
    for (Entrada e : asc) {
      Long productoId = e.getProducto().getId();
      anteriorPorId.put(e.getId(), ultimoPorProducto.get(productoId));
      if (e.getPrecioProveedor() != null) {
        ultimoPorProducto.put(productoId, e.getPrecioProveedor());
      }
    }
    return anteriorPorId;
  }

  private BigDecimal ultimaCompraProducto(Long productoId) {
    return entradaRepo.findFirstByProductoIdAndPrecioProveedorIsNotNullOrderByFechaDescIdDesc(productoId)
        .map(Entrada::getPrecioProveedor)
        .orElseGet(() -> {
          Producto p = productoRepo.findById(productoId).orElse(null);
          return p != null && p.getPrecioCompra() != null ? p.getPrecioCompra() : null;
        });
  }

  private BigDecimal ultimaCompraAntesDe(Entrada e) {
    return entradaRepo
        .findFirstByProductoIdAndIdNotAndPrecioProveedorIsNotNullOrderByFechaDescIdDesc(
            e.getProducto().getId(), e.getId())
        .map(Entrada::getPrecioProveedor)
        .orElseGet(() -> {
          Producto p = e.getProducto();
          return p.getPrecioCompra() != null ? p.getPrecioCompra() : null;
        });
  }

  private EntradaDto toDto(Entrada e, BigDecimal precioAnteriorCompra) {
    Producto p = e.getProducto();
    BigDecimal anterior = precioAnteriorCompra;
    if (anterior == null && p.getPrecioCompra() != null) {
      anterior = p.getPrecioCompra();
    }
    boolean mayor = false;
    boolean menor = false;
    if (e.getPrecioProveedor() != null && anterior != null) {
      int cmp = e.getPrecioProveedor().compareTo(anterior);
      mayor = cmp > 0;
      menor = cmp < 0;
    }
    Long pedidoId = e.getPedido() != null ? e.getPedido().getId() : null;
    return new EntradaDto(
        e.getId(),
        e.getFecha(),
        p.getId(),
        p.getNombre(),
        e.getCantidad(),
        e.getPrecioProveedor(),
        e.getTotal(),
        anterior,
        mayor,
        menor,
        pedidoId,
        pedidoId != null
    );
  }
}
