package com.productoslimpieza.service;

import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.DepartamentoProducto;
import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.EstadoPedido;
import com.productoslimpieza.domain.Pedido;
import com.productoslimpieza.domain.PedidoAbono;
import com.productoslimpieza.domain.PedidoItem;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.PedidoAbonoRepository;
import com.productoslimpieza.repo.PedidoRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.web.dto.ApartadoDto;
import com.productoslimpieza.web.dto.ApartadoRequest;
import com.productoslimpieza.web.dto.PedidoAbonoDto;
import com.productoslimpieza.web.dto.PedidoAbonoRequest;
import com.productoslimpieza.web.dto.PedidoCreditoRequest;
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
  private final PedidoAbonoRepository abonoRepo;
  private final ApartadoService apartadoService;

  public PedidoRegistroService(
      PedidoRepository pedidoRepo,
      ProductoRepository productoRepo,
      EntradaRepository entradaRepo,
      PedidoAbonoRepository abonoRepo,
      ApartadoService apartadoService) {
    this.pedidoRepo = pedidoRepo;
    this.productoRepo = productoRepo;
    this.entradaRepo = entradaRepo;
    this.abonoRepo = abonoRepo;
    this.apartadoService = apartadoService;
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
    if (req.fechaLimitePago() != null) {
      p.setFechaLimitePago(req.fechaLimitePago());
      pedidoRepo.save(p);
    }
    recalcularRecibidoDesdeEntradas(pedidoId);
    // Solo registra pago si viene explícito (null = solo mercancía, el pago va después).
    if (req.pagadoAhora() != null && req.pagadoAhora().compareTo(BigDecimal.ZERO) > 0) {
      registrarPagoSiHay(p.getId(), req.pagadoAhora(), hoy, "Pago al recibir surtido");
    } else {
      activarCreditoSiHayDeudaSinPagos(pedidoId);
    }
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
    BigDecimal total = nz(entradaRepo.sumTotalByPedidoId(id)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal pagado = nz(abonoRepo.sumMontoByPedidoId(id)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal saldo = total.subtract(pagado);
    if (saldo.compareTo(new BigDecimal("0.009")) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Todavía debes $"
              + saldo.setScale(2, RoundingMode.HALF_UP).toPlainString()
              + " en este pedido. Sáldalo o déjalo a crédito; no lo borres o pierdes el control de la deuda.");
    }
    // Quita pagos/gastos; el stock de entradas se conserva.
    List<PedidoAbono> abonos = abonoRepo.findByPedidoIdOrderByFechaDescIdDesc(id);
    for (PedidoAbono a : abonos) {
      borrarGastoLigado(a);
      abonoRepo.delete(a);
    }
    for (var e : entradaRepo.findByPedidoId(id)) {
      e.setPedido(null);
      entradaRepo.save(e);
    }
    pedidoRepo.delete(p);
  }

  /**
   * Cancela un pedido sin mercancía: no deja entradas ni stock. Si ya hubo recepción, usar {@link #eliminar}.
   */
  @Transactional
  public void cancelar(Long id) {
    Pedido p = pedidoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    List<Entrada> entradas = entradaRepo.findByPedidoId(id);
    if (!entradas.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Ya hay mercancía registrada. Usa Eliminar (el stock se queda).");
    }
    Pedido full = pedidoRepo.findByIdWithItems(id).orElse(p);
    boolean algoRecibido = full.getItems().stream()
        .anyMatch(i -> nz(i.getCantidadRecibida()).compareTo(BigDecimal.ZERO) > 0);
    if (algoRecibido) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Ya hay mercancía registrada. Usa Eliminar (el stock se queda).");
    }
    List<PedidoAbono> abonos = abonoRepo.findByPedidoIdOrderByFechaDescIdDesc(id);
    for (PedidoAbono a : abonos) {
      borrarGastoLigado(a);
      abonoRepo.delete(a);
    }
    pedidoRepo.delete(p);
  }

  @Transactional
  public PedidoDto actualizarCredito(Long id, PedidoCreditoRequest req) {
    Pedido p = pedidoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    p.setFechaLimitePago(req.fechaLimitePago());
    pedidoRepo.save(p);
    return obtener(id);
  }

  @Transactional
  public PedidoDto agregarItem(Long pedidoId, PedidoItemRequest req) {
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    if (p.getEstado() == EstadoPedido.CERRADO) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido ya está cerrado");
    }
    agregarOSumarItem(p, req);
    pedidoRepo.save(p);
    aplicarEstadoSegunItems(p);
    return obtener(pedidoId);
  }

  @Transactional
  public PedidoDto actualizarItem(Long pedidoId, Long itemId, PedidoItemRequest req) {
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    if (p.getEstado() == EstadoPedido.CERRADO) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido ya está cerrado");
    }
    PedidoItem item = p.getItems().stream()
        .filter(i -> i.getId().equals(itemId))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no está en el pedido"));
    BigDecimal pedida = normalizarCantidad(item.getProducto(), req.cantidad());
    BigDecimal rec = recibido(item);
    if (pedida.compareTo(rec) < 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No puedes pedir menos de lo ya recibido (" + rec.stripTrailingZeros().toPlainString() + ")");
    }
    item.setCantidadPedida(pedida);
    pedidoRepo.save(p);
    aplicarEstadoSegunItems(p);
    return obtener(pedidoId);
  }

  @Transactional
  public PedidoDto eliminarItem(Long pedidoId, Long itemId) {
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    if (p.getEstado() == EstadoPedido.CERRADO) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido ya está cerrado");
    }
    PedidoItem item = p.getItems().stream()
        .filter(i -> i.getId().equals(itemId))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no está en el pedido"));
    if (recibido(item).compareTo(BigDecimal.ZERO) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Ya hay mercancía recibida de «" + item.getProducto().getNombre() + "». No se puede quitar.");
    }
    p.getItems().remove(item);
    item.setPedido(null);
    if (p.getItems().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido no puede quedarse sin productos");
    }
    pedidoRepo.save(p);
    aplicarEstadoSegunItems(p);
    return obtener(pedidoId);
  }

  @Transactional
  public PedidoDto crearAbono(Long pedidoId, PedidoAbonoRequest req) {
    Pedido p = pedidoRepo.findById(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    if (req.fechaLimitePago() != null) {
      p.setFechaLimitePago(req.fechaLimitePago());
      pedidoRepo.save(p);
    }
    registrarPagoSiHay(pedidoId, req.monto(), req.fecha(), req.nota());
    return obtener(pedidoId);
  }

  @Transactional
  public PedidoDto actualizarAbono(Long abonoId, PedidoAbonoRequest req) {
    PedidoAbono a = abonoRepo.findById(abonoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pago no encontrado"));
    Long pedidoId = a.getPedido().getId();
    BigDecimal total = nz(entradaRepo.sumTotalByPedidoId(pedidoId)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal pagadoOtros = nz(abonoRepo.sumMontoByPedidoId(pedidoId)).subtract(nz(a.getMonto()));
    BigDecimal max = total.subtract(pagadoOtros).setScale(2, RoundingMode.HALF_UP);
    if (req.monto().compareTo(max.add(new BigDecimal("0.01"))) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "El pago no puede ser mayor a lo que falta ($" + max.max(BigDecimal.ZERO).toPlainString() + ")");
    }
    BigDecimal nuevo = req.monto().setScale(2, RoundingMode.HALF_UP);
    a.setFecha(req.fecha());
    a.setMonto(nuevo);
    a.setNota(req.nota() != null && !req.nota().isBlank() ? req.nota().trim() : null);
    String motivo = motivoGastoSurtir(pedidoId);
    if (a.getApartadoId() != null) {
      apartadoService.actualizar(
          a.getApartadoId(),
          new ApartadoRequest(
              req.fecha(),
              CategoriaApartado.PRODUCTOS.name(),
              nuevo,
              TipoMovimientoApartado.GASTO,
              motivo));
    } else {
      ApartadoDto gasto =
          apartadoService.crear(
              new ApartadoRequest(
                  req.fecha(),
                  CategoriaApartado.PRODUCTOS.name(),
                  nuevo,
                  TipoMovimientoApartado.GASTO,
                  motivo));
      a.setApartadoId(gasto.id());
    }
    abonoRepo.save(a);
    if (req.fechaLimitePago() != null) {
      Pedido p = a.getPedido();
      p.setFechaLimitePago(req.fechaLimitePago());
      pedidoRepo.save(p);
    }
    return obtener(pedidoId);
  }

  @Transactional
  public PedidoDto eliminarAbono(Long abonoId) {
    PedidoAbono a = abonoRepo.findById(abonoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pago no encontrado"));
    Long pedidoId = a.getPedido().getId();
    borrarGastoLigado(a);
    abonoRepo.delete(a);
    return obtener(pedidoId);
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
    BigDecimal totalProveedor = nz(entradaRepo.sumTotalByPedidoId(full.getId())).setScale(2, RoundingMode.HALF_UP);
    List<PedidoAbonoDto> abonos = abonoRepo.findByPedidoIdOrderByFechaDescIdDesc(full.getId()).stream()
        .map(a -> new PedidoAbonoDto(
            a.getId(),
            full.getId(),
            a.getFecha(),
            nz(a.getMonto()).setScale(2, RoundingMode.HALF_UP),
            a.getNota()))
        .toList();
    // Solo cuenta como pagado lo registrado en abonos. Mercancía sin pagos = deuda
    // (aunque aún no hayan puesto fecha de crédito).
    BigDecimal totalPagado = abonos.stream()
        .map(PedidoAbonoDto::monto)
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal saldo = totalProveedor.subtract(totalPagado).setScale(2, RoundingMode.HALF_UP);
    if (saldo.compareTo(BigDecimal.ZERO) < 0) {
      saldo = BigDecimal.ZERO;
    }
    boolean tieneEntradas = !entradaRepo.findByPedidoId(full.getId()).isEmpty()
        || items.stream().anyMatch(i -> i.cantidadRecibida().compareTo(BigDecimal.ZERO) > 0);
    return new PedidoDto(
        full.getId(),
        full.getFecha(),
        full.getEstado().name(),
        full.getPeriodoDesde(),
        full.getPeriodoHasta(),
        full.getDiasCobertura(),
        full.getPorcentajeExtra(),
        full.getNota(),
        full.getFechaLimitePago(),
        totalProveedor,
        totalPagado,
        saldo,
        items.size(),
        conFalta,
        tieneEntradas,
        items,
        abonos);
  }

  private void registrarPagoSiHay(Long pedidoId, BigDecimal monto, LocalDate fecha, String nota) {
    if (monto == null || monto.compareTo(BigDecimal.ZERO) <= 0) {
      return;
    }
    BigDecimal pago = monto.setScale(2, RoundingMode.HALF_UP);
    BigDecimal total = nz(entradaRepo.sumTotalByPedidoId(pedidoId)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal pagado = nz(abonoRepo.sumMontoByPedidoId(pedidoId)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal max = total.subtract(pagado);
    if (max.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este pedido ya está saldado");
    }
    if (pago.compareTo(max) > 0) {
      pago = max;
    }
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido no encontrado"));
    LocalDate f = fecha != null ? fecha : LocalDate.now(ZONA);
    String motivo = motivoGastoSurtir(p);
    ApartadoDto gasto =
        apartadoService.crear(
            new ApartadoRequest(
                f,
                CategoriaApartado.PRODUCTOS.name(),
                pago,
                TipoMovimientoApartado.GASTO,
                motivo));
    PedidoAbono a = new PedidoAbono();
    a.setPedido(p);
    a.setFecha(f);
    a.setMonto(pago);
    a.setApartadoId(gasto.id());
    if (nota != null && !nota.isBlank()) {
      a.setNota(nota.trim());
    } else {
      a.setNota("Surtir · " + motivo);
    }
    abonoRepo.save(a);
  }

  private void borrarGastoLigado(PedidoAbono a) {
    if (a.getApartadoId() == null) return;
    try {
      apartadoService.eliminar(a.getApartadoId());
    } catch (ResponseStatusException ex) {
      if (ex.getStatusCode() != HttpStatus.NOT_FOUND) {
        throw ex;
      }
    }
    a.setApartadoId(null);
  }

  /** Tras guardar mercancía sin pago, activa el control de crédito (saldo pendiente). */
  private void activarCreditoSiHayDeudaSinPagos(Long pedidoId) {
    Pedido p = pedidoRepo.findById(pedidoId).orElse(null);
    if (p == null) return;
    BigDecimal total = nz(entradaRepo.sumTotalByPedidoId(pedidoId));
    BigDecimal pagado = nz(abonoRepo.sumMontoByPedidoId(pedidoId));
    if (total.subtract(pagado).compareTo(new BigDecimal("0.009")) <= 0) return;
    if (p.getFechaLimitePago() != null) return;
    p.setFechaLimitePago(LocalDate.now(ZONA));
    pedidoRepo.save(p);
  }

  /** Motivo del gasto según departamentos del pedido (recibidos; si no hay, todos). */
  private String motivoGastoSurtir(Long pedidoId) {
    Pedido p = pedidoRepo.findByIdWithItems(pedidoId).orElse(null);
    return p == null ? "productos" : motivoGastoSurtir(p);
  }

  private String motivoGastoSurtir(Pedido p) {
    boolean limpia = false;
    boolean jarceria = false;
    List<PedidoItem> base = p.getItems().stream()
        .filter(i -> recibido(i).compareTo(BigDecimal.ZERO) > 0)
        .toList();
    if (base.isEmpty()) {
      base = p.getItems();
    }
    for (PedidoItem item : base) {
      Producto prod = item.getProducto();
      DepartamentoProducto d = prod.getDepartamento();
      if (d == null) {
        d = DepartamentoProducto.inferir(prod.getVendePor(), prod.getNombre());
      }
      if (d == DepartamentoProducto.JARCERIA) {
        jarceria = true;
      } else {
        limpia = true;
      }
    }
    if (limpia && jarceria) return "productos y jarceria";
    if (jarceria) return "jarceria";
    return "productos";
  }

  private void agregarOSumarItem(Pedido pedido, PedidoItemRequest linea) {
    if (linea.cantidad() == null || linea.cantidad().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad debe ser mayor a 0");
    }
    Producto producto = productoRepo.findById(linea.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    if (!producto.isActivo()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto inactivo: " + producto.getNombre());
    }
    BigDecimal pedida = normalizarCantidad(producto, linea.cantidad());
    for (PedidoItem existente : pedido.getItems()) {
      if (existente.getProducto().getId().equals(producto.getId())) {
        existente.setCantidadPedida(existente.getCantidadPedida().add(pedida));
        return;
      }
    }
    PedidoItem item = new PedidoItem();
    item.setProducto(producto);
    item.setCantidadRecibida(BigDecimal.ZERO);
    item.setCantidadPedida(pedida);
    pedido.addItem(item);
  }

  private BigDecimal normalizarCantidad(Producto producto, BigDecimal cantidad) {
    UnidadVenta u = producto.getVendePor() != null ? producto.getVendePor() : UnidadVenta.LITROS;
    return u == UnidadVenta.PIEZA
        ? cantidad.setScale(0, RoundingMode.CEILING)
        : cantidad.setScale(2, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
