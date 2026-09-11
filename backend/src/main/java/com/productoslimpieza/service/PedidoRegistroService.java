package com.productoslimpieza.service;

import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.EstadoPedido;
import com.productoslimpieza.domain.Pedido;
import com.productoslimpieza.domain.PedidoItem;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.PedidoRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.web.dto.PedidoDto;
import com.productoslimpieza.web.dto.PedidoItemDto;
import com.productoslimpieza.web.dto.PedidoItemRequest;
import com.productoslimpieza.web.dto.PedidoRecepcionRequest;
import com.productoslimpieza.web.dto.PedidoRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PedidoRegistroService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final PedidoRepository pedidoRepo;
  private final ProductoRepository productoRepo;
  private final EntradaRepository entradaRepo;

  public PedidoRegistroService(
      PedidoRepository pedidoRepo,
      ProductoRepository productoRepo,
      EntradaRepository entradaRepo) {
    this.pedidoRepo = pedidoRepo;
    this.productoRepo = productoRepo;
    this.entradaRepo = entradaRepo;
  }

  @Transactional(readOnly = true)
  public List<PedidoDto> listar() {
    return pedidoRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public List<PedidoDto> listarAbiertos() {
    return pedidoRepo
        .findByEstadoInOrderByFechaAscIdAsc(EnumSet.of(EstadoPedido.ABIERTO, EstadoPedido.PARCIAL))
        .stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public PedidoDto obtener(Long id) {
    Pedido p = pedidoRepo.findByIdWithItems(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    return toDto(p);
  }

  /** Faltantes de pedidos abiertos/parciales, sumados por producto. */
  @Transactional(readOnly = true)
  public Map<Long, BigDecimal> faltantesAbiertosPorProducto() {
    Map<Long, BigDecimal> map = new HashMap<>();
    List<Pedido> abiertos = pedidoRepo.findByEstadoInOrderByFechaAscIdAsc(
        EnumSet.of(EstadoPedido.ABIERTO, EstadoPedido.PARCIAL));
    for (Pedido p : abiertos) {
      Pedido full = pedidoRepo.findByIdWithItems(p.getId()).orElse(p);
      for (PedidoItem item : full.getItems()) {
        BigDecimal fal = faltante(item);
        if (fal.compareTo(BigDecimal.ZERO) <= 0) continue;
        Long pid = item.getProducto().getId();
        map.merge(pid, fal, BigDecimal::add);
      }
    }
    return map;
  }

  @Transactional
  public PedidoDto crear(PedidoRequest req) {
    if (req.items() == null || req.items().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido no tiene productos");
    }
    Pedido pedido = new Pedido();
    pedido.setFecha(req.fecha() != null ? req.fecha() : LocalDate.now(ZONA));
    pedido.setEstado(EstadoPedido.ABIERTO);
    pedido.setPeriodoDesde(req.periodoDesde());
    pedido.setPeriodoHasta(req.periodoHasta());
    pedido.setDiasCobertura(req.diasCobertura());
    pedido.setPorcentajeExtra(req.porcentajeExtra());
    if (req.nota() != null && !req.nota().isBlank()) {
      pedido.setNota(req.nota().trim());
    }

    Map<Long, PedidoItem> porProducto = new HashMap<>();
    for (PedidoItemRequest linea : req.items()) {
      if (linea.cantidad() == null || linea.cantidad().compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      Producto producto = productoRepo.findById(linea.productoId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
      if (!producto.isActivo()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto inactivo: " + producto.getNombre());
      }
      UnidadVenta u = producto.getVendePor() != null ? producto.getVendePor() : UnidadVenta.LITROS;
      BigDecimal pedida = u == UnidadVenta.PIEZA
          ? linea.cantidad().setScale(0, RoundingMode.CEILING)
          : linea.cantidad().setScale(2, RoundingMode.HALF_UP);
      PedidoItem existente = porProducto.get(producto.getId());
      if (existente != null) {
        existente.setCantidadPedida(existente.getCantidadPedida().add(pedida));
        continue;
      }
      PedidoItem item = new PedidoItem();
      item.setProducto(producto);
      item.setCantidadRecibida(BigDecimal.ZERO);
      item.setCantidadPedida(pedida);
      pedido.addItem(item);
      porProducto.put(producto.getId(), item);
    }
    if (pedido.getItems().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido no tiene productos");
    }
    return toDto(pedidoRepo.save(pedido));
  }

  /**
   * Registra cuánto llegó. Si supera lo ya cubierto por entradas ligadas, crea la(s)
   * entrada(s) faltante(s) para que el stock y lo recibido queden alineados.
   */
  @Transactional
  public PedidoDto registrarRecepcion(Long pedidoId, PedidoRecepcionRequest req) {
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    if (p.getEstado() == EstadoPedido.CERRADO) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido ya está cerrado");
    }
    Map<Long, PedidoItem> byId = new HashMap<>();
    for (PedidoItem item : p.getItems()) {
      byId.put(item.getId(), item);
    }
    LocalDate hoy = LocalDate.now(ZONA);
    for (PedidoRecepcionRequest.Linea linea : req.lineas()) {
      PedidoItem item = byId.get(linea.itemId());
      if (item == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Línea de pedido no válida");
      }
      BigDecimal rec = linea.cantidadRecibida() != null ? linea.cantidadRecibida() : BigDecimal.ZERO;
      if (rec.compareTo(BigDecimal.ZERO) < 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad recibida no puede ser negativa");
      }
      UnidadVenta u = item.getProducto().getVendePor() != null
          ? item.getProducto().getVendePor()
          : UnidadVenta.LITROS;
      if (u == UnidadVenta.PIEZA) {
        rec = rec.setScale(0, RoundingMode.HALF_UP);
      } else {
        rec = rec.setScale(2, RoundingMode.HALF_UP);
      }
      BigDecimal fromEntradas = nz(entradaRepo.sumCantidadByPedidoAndProducto(p, item.getProducto()));
      if (rec.compareTo(fromEntradas) < 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "«"
                + item.getProducto().getNombre()
                + "» ya tiene "
                + fromEntradas.stripTrailingZeros().toPlainString()
                + " en entradas ligadas. Baja o borra esas entradas si quieres menos recibido.");
      }
      BigDecimal delta = rec.subtract(fromEntradas);
      if (delta.compareTo(BigDecimal.ZERO) > 0) {
        Entrada e = new Entrada();
        e.setFecha(hoy);
        e.setProducto(item.getProducto());
        e.setCantidad(delta);
        BigDecimal precio =
            linea.precioProveedor() != null
                ? linea.precioProveedor()
                : item.getProducto().getPrecioCompra();
        if (precio != null && precio.compareTo(BigDecimal.ZERO) < 0) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El precio del proveedor no puede ser negativo");
        }
        e.setPrecioProveedor(precio);
        if (precio != null) {
          e.setTotal(delta.multiply(precio).setScale(2, RoundingMode.HALF_UP));
        }
        e.setPedido(p);
        entradaRepo.save(e);
        actualizarPrecioCompraSiCambio(item.getProducto(), precio);
      }
    }
    recalcularRecibidoDesdeEntradas(pedidoId);
    return obtener(pedidoId);
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

  /** Sincroniza cantidad recibida = suma de entradas ligadas al pedido. */
  @Transactional
  public void recalcularRecibidoDesdeEntradas(Long pedidoId) {
    if (pedidoId == null) return;
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId).orElse(null);
    if (p == null) return;
    for (PedidoItem item : p.getItems()) {
      BigDecimal fromEntradas = nz(entradaRepo.sumCantidadByPedidoAndProducto(p, item.getProducto()));
      UnidadVenta u = item.getProducto().getVendePor() != null
          ? item.getProducto().getVendePor()
          : UnidadVenta.LITROS;
      if (u == UnidadVenta.PIEZA) {
        item.setCantidadRecibida(fromEntradas.setScale(0, RoundingMode.HALF_UP));
      } else {
        item.setCantidadRecibida(fromEntradas.setScale(2, RoundingMode.HALF_UP));
      }
    }
    pedidoRepo.save(p);
    aplicarEstadoSegunItems(p);
  }

  @Transactional
  public PedidoDto cerrar(Long id) {
    Pedido p = pedidoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    p.setEstado(EstadoPedido.CERRADO);
    return toDto(pedidoRepo.save(p));
  }

  @Transactional
  public void eliminar(Long id) {
    Pedido p = pedidoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    for (var e : entradaRepo.findByPedidoId(id)) {
      e.setPedido(null);
      entradaRepo.save(e);
    }
    pedidoRepo.delete(p);
  }

  @Transactional
  public void refrescarEstado(Long pedidoId) {
    recalcularRecibidoDesdeEntradas(pedidoId);
  }

  /**
   * Pedido explícito para ligar una entrada: debe incluir el producto y no estar cerrado.
   * Permite sobrerecepción (faltante 0).
   */
  @Transactional(readOnly = true)
  public Optional<Pedido> pedidoParaEntrada(Long productoId, Long pedidoId) {
    if (pedidoId == null || productoId == null) return Optional.empty();
    return pedidoRepo.findByIdWithItems(pedidoId).filter(p ->
        p.getEstado() != EstadoPedido.CERRADO
            && p.getItems().stream().anyMatch(i -> i.getProducto().getId().equals(productoId)));
  }

  /** Resuelve pedido para producto (explícito o el más viejo con faltante). */
  @Transactional(readOnly = true)
  public Optional<Pedido> resolverPedidoParaProducto(Long productoId, Long pedidoIdPreferido) {
    if (pedidoIdPreferido != null) {
      return pedidoParaEntrada(productoId, pedidoIdPreferido);
    }
    List<Pedido> abiertos = pedidoRepo.findByEstadoInOrderByFechaAscIdAsc(
        EnumSet.of(EstadoPedido.ABIERTO, EstadoPedido.PARCIAL));
    for (Pedido p : abiertos) {
      Pedido full = pedidoRepo.findByIdWithItems(p.getId()).orElse(p);
      boolean match = full.getItems().stream().anyMatch(i ->
          i.getProducto().getId().equals(productoId)
              && faltante(i).compareTo(BigDecimal.ZERO) > 0);
      if (match) return Optional.of(full);
    }
    return Optional.empty();
  }

  private void aplicarEstadoSegunItems(Pedido p) {
    boolean algunaRecibida = false;
    boolean algunaFalta = false;
    for (PedidoItem item : p.getItems()) {
      BigDecimal rec = recibido(item);
      if (rec.compareTo(BigDecimal.ZERO) > 0) algunaRecibida = true;
      if (faltante(item).compareTo(BigDecimal.ZERO) > 0) algunaFalta = true;
    }
    if (!algunaFalta) {
      p.setEstado(EstadoPedido.CERRADO);
    } else if (algunaRecibida) {
      p.setEstado(EstadoPedido.PARCIAL);
    } else {
      p.setEstado(EstadoPedido.ABIERTO);
    }
    pedidoRepo.save(p);
  }

  private BigDecimal recibido(PedidoItem item) {
    return nz(item.getCantidadRecibida()).setScale(2, RoundingMode.HALF_UP);
  }

  private BigDecimal faltante(PedidoItem item) {
    BigDecimal fal = item.getCantidadPedida().subtract(recibido(item));
    return fal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : fal.setScale(2, RoundingMode.HALF_UP);
  }

  private PedidoDto toDto(Pedido p) {
    Pedido full = pedidoRepo.findByIdWithItems(p.getId()).orElse(p);
    List<PedidoItemDto> items = full.getItems().stream().map(i -> {
      Producto prod = i.getProducto();
      UnidadVenta u = prod.getVendePor() != null ? prod.getVendePor() : UnidadVenta.LITROS;
      // Lectura: preferir suma de entradas si el cache quedó viejo (sin escribir).
      BigDecimal fromEntradas = nz(entradaRepo.sumCantidadByPedidoAndProducto(full, prod));
      BigDecimal rec = fromEntradas.max(recibido(i));
      BigDecimal fal = i.getCantidadPedida().subtract(rec);
      if (fal.compareTo(BigDecimal.ZERO) < 0) fal = BigDecimal.ZERO;
      fal = fal.setScale(2, RoundingMode.HALF_UP);
      return new PedidoItemDto(
          i.getId(),
          prod.getId(),
          prod.getNombre(),
          u.name(),
          u.toLabel(),
          i.getCantidadPedida(),
          rec.setScale(2, RoundingMode.HALF_UP),
          fal,
          prod.getPrecioCompra());
    }).toList();
    int conFalta = (int) items.stream().filter(i -> i.cantidadFaltante().compareTo(BigDecimal.ZERO) > 0).count();
    return new PedidoDto(
        full.getId(),
        full.getFecha(),
        full.getEstado().name(),
        full.getPeriodoDesde(),
        full.getPeriodoHasta(),
        full.getDiasCobertura(),
        full.getPorcentajeExtra(),
        full.getNota(),
        items.size(),
        conFalta,
        items);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
