package com.productoslimpieza.service;

import com.productoslimpieza.domain.InversionItem;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.InversionRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.InversionItemDto;
import com.productoslimpieza.web.dto.InversionItemRequest;
import com.productoslimpieza.web.dto.InversionResumenDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InversionService {

  /** Ventas que cuentan para ROI / recuperación inicial. */
  private static final List<TipoVenta> VENTAS_PRODUCTO =
      List.of(
          TipoVenta.LITROS,
          TipoVenta.PIEZA,
          TipoVenta.MAYOREO,
          TipoVenta.PESOS,
          TipoVenta.MUESTRA,
          TipoVenta.CASA);

  /** Tipos donde cantidad = unidades físicas (costo = cant × compra). */
  private static final List<TipoVenta> VENTAS_UNIDADES =
      List.of(
          TipoVenta.LITROS,
          TipoVenta.PIEZA,
          TipoVenta.MAYOREO,
          TipoVenta.MUESTRA,
          TipoVenta.CASA);

  private final InversionRepository inversionRepo;
  private final EntradaRepository entradaRepo;
  private final ProductoRepository productoRepo;
  private final VentaRepository ventaRepo;
  private final PrecioService precioService;

  public InversionService(
      InversionRepository inversionRepo,
      EntradaRepository entradaRepo,
      ProductoRepository productoRepo,
      VentaRepository ventaRepo,
      PrecioService precioService) {
    this.inversionRepo = inversionRepo;
    this.entradaRepo = entradaRepo;
    this.productoRepo = productoRepo;
    this.ventaRepo = ventaRepo;
    this.precioService = precioService;
  }

  @Transactional(readOnly = true)
  public InversionResumenDto resumen() {
    List<InversionItem> all = inversionRepo.findAllByOrderByTipoAscConceptoAsc();
    BigDecimal productosIniciales = BigDecimal.ZERO;
    BigDecimal infra = BigDecimal.ZERO;
    for (InversionItem i : all) {
      BigDecimal monto = nz(i.getMonto());
      if ("PRODUCTO".equalsIgnoreCase(i.getTipo())) {
        productosIniciales = productosIniciales.add(monto);
      } else {
        infra = infra.add(monto);
      }
    }
    BigDecimal stockAlta = nz(productoRepo.sumInversionStockInicial());
    BigDecimal entradas = nz(entradaRepo.sumTotal());
    BigDecimal reinversion = stockAlta.add(entradas);

    BigDecimal inversionInicial = productosIniciales.add(infra);
    BigDecimal totalVentas = nz(ventaRepo.sumTotalByTipos(VENTAS_PRODUCTO));
    // Recuperación inicial: ventas de producto − inversión inicial (no usa costo ni reinversión).
    BigDecimal retorno = totalVentas.subtract(inversionInicial);
    boolean recuperada = retorno.compareTo(BigDecimal.ZERO) >= 0;
    BigDecimal faltante =
        recuperada ? BigDecimal.ZERO : retorno.negate().setScale(2, RoundingMode.HALF_UP);
    BigDecimal gananciaInicial =
        recuperada
            ? retorno.setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    BigDecimal costo = calcularCostoMercanciaVendida();
    BigDecimal gananciaBruta = totalVentas.subtract(costo).setScale(2, RoundingMode.HALF_UP);
    BigDecimal margenPct = BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
    if (totalVentas.compareTo(BigDecimal.ZERO) > 0) {
      margenPct =
          gananciaBruta
              .multiply(new BigDecimal("100"))
              .divide(totalVentas, 1, RoundingMode.HALF_UP);
    }

    List<InversionItemDto> items = all.stream()
        .map(i -> new InversionItemDto(
            i.getId(), i.getTipo(), i.getConcepto(),
            i.getCantidad(), i.getPrecioUnidad(), i.getMonto()))
        .toList();

    return new InversionResumenDto(
        scale(productosIniciales),
        scale(infra),
        scale(inversionInicial),
        scale(stockAlta),
        scale(entradas),
        scale(reinversion),
        scale(totalVentas),
        scale(retorno),
        recuperada,
        faltante,
        gananciaInicial,
        scale(costo),
        gananciaBruta,
        margenPct,
        items
    );
  }

  /**
   * Costo de lo vendido: unidades × precio compra; en Pesos, monto × (compra / menudeo).
   */
  private BigDecimal calcularCostoMercanciaVendida() {
    BigDecimal costoUnidades = nz(ventaRepo.sumCostoUnidadesByTipos(VENTAS_UNIDADES));
    BigDecimal costoPesos = BigDecimal.ZERO;
    for (Venta v : ventaRepo.findByTipoConProducto(TipoVenta.PESOS)) {
      Producto p = v.getProducto();
      if (p == null || v.getCantidad() == null) {
        continue;
      }
      BigDecimal compra = nz(p.getPrecioCompra());
      if (compra.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      BigDecimal menudeo = nz(precioService.precioVigente(p, v.getFecha()));
      if (menudeo.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      // monto$ / menudeo = unidades equivalentes; × compra = costo
      costoPesos =
          costoPesos.add(
              v.getCantidad().multiply(compra).divide(menudeo, 4, RoundingMode.HALF_UP));
    }
    return costoUnidades.add(costoPesos);
  }

  @Transactional
  public InversionItemDto crear(InversionItemRequest req) {
    if (req.tipo() != null && "PRODUCTO".equalsIgnoreCase(req.tipo().trim())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Ya no se pueden agregar productos a la inversión inicial");
    }
    InversionItem i = new InversionItem();
    aplicar(i, req);
    return toDto(inversionRepo.save(i));
  }

  @Transactional
  public InversionItemDto actualizar(Long id, InversionItemRequest req) {
    InversionItem i = inversionRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ítem no encontrado"));
    String tipoReq = req.tipo() == null ? "" : req.tipo().trim().toUpperCase();
    boolean yaEsProducto = "PRODUCTO".equalsIgnoreCase(i.getTipo());
    if ("PRODUCTO".equals(tipoReq) && !yaEsProducto) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Ya no se pueden agregar productos a la inversión inicial");
    }
    aplicar(i, req);
    return toDto(inversionRepo.save(i));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!inversionRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ítem no encontrado");
    }
    inversionRepo.deleteById(id);
  }

  private void aplicar(InversionItem i, InversionItemRequest req) {
    if (req.tipo() == null || req.tipo().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el tipo");
    }
    if (req.concepto() == null || req.concepto().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el concepto");
    }
    String tipo = req.tipo().trim().toUpperCase();
    if (!tipo.equals("PRODUCTO") && !tipo.equals("INFRAESTRUCTURA")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Tipo debe ser PRODUCTO o INFRAESTRUCTURA");
    }
    i.setTipo(tipo);
    i.setConcepto(req.concepto().trim());
    i.setCantidad(req.cantidad());
    i.setPrecioUnidad(req.precioUnidad());
    BigDecimal monto = req.monto();
    if (monto == null
        && req.cantidad() != null
        && req.precioUnidad() != null) {
      monto = req.cantidad().multiply(req.precioUnidad()).setScale(2, RoundingMode.HALF_UP);
    }
    if (monto == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Indica cantidad y precio, o el monto total");
    }
    if (monto.compareTo(BigDecimal.ZERO) < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto no puede ser negativo");
    }
    i.setMonto(monto);
  }

  private InversionItemDto toDto(InversionItem i) {
    return new InversionItemDto(
        i.getId(), i.getTipo(), i.getConcepto(),
        i.getCantidad(), i.getPrecioUnidad(), i.getMonto());
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static BigDecimal scale(BigDecimal v) {
    return nz(v).setScale(2, RoundingMode.HALF_UP);
  }
}
