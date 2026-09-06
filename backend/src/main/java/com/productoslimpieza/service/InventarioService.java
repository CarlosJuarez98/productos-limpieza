package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.InventarioDto;
import com.productoslimpieza.web.dto.ProductoRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventarioService {

  private static final BigDecimal MARGIN_MIN = new BigDecimal("0.465");
  private static final BigDecimal MARGIN_MAX = new BigDecimal("0.63");

  private final ProductoRepository productoRepo;
  private final EntradaRepository entradaRepo;
  private final VentaRepository ventaRepo;
  private final PrecioService precioService;
  private final PrecioHistoricoService precioHistoricoService;

  public InventarioService(
      ProductoRepository productoRepo,
      EntradaRepository entradaRepo,
      VentaRepository ventaRepo,
      PrecioService precioService,
      PrecioHistoricoService precioHistoricoService) {
    this.productoRepo = productoRepo;
    this.entradaRepo = entradaRepo;
    this.ventaRepo = ventaRepo;
    this.precioService = precioService;
    this.precioHistoricoService = precioHistoricoService;
  }

  @Transactional(readOnly = true)
  public List<InventarioDto> listar() {
    return productoRepo.findAllByOrderByNombreAsc().stream().map(this::toDto).toList();
  }

  @Transactional
  public InventarioDto crear(ProductoRequest req) {
    if (productoRepo.existsByNombreIgnoreCase(req.nombre().trim())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un producto con ese nombre");
    }
    Producto p = new Producto();
    p.setNombre(req.nombre().trim());
    p.setPrecioCompra(nz(req.precioCompra()));
    p.setCantidadInicial(nz(req.cantidadInicial()));
    p = productoRepo.save(p);
    if (req.precioVenta() != null) {
      LocalDate fecha = req.fechaVigenciaPrecio() != null ? req.fechaVigenciaPrecio() : LocalDate.now();
      precioHistoricoService.crearDirecto(p, fecha, req.precioVenta());
    }
    return toDto(p);
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
    p.setNombre(req.nombre().trim());
    if (req.precioCompra() != null) {
      p.setPrecioCompra(req.precioCompra());
    }
    if (req.cantidadInicial() != null) {
      p.setCantidadInicial(req.cantidadInicial());
    }
    p = productoRepo.save(p);
    if (req.precioVenta() != null) {
      LocalDate fecha = req.fechaVigenciaPrecio() != null ? req.fechaVigenciaPrecio() : LocalDate.now();
      precioHistoricoService.crearDirecto(p, fecha, req.precioVenta());
    }
    return toDto(p);
  }

  private InventarioDto toDto(Producto p) {
    BigDecimal venta = precioService.precioHoy(p);
    BigDecimal compra = nz(p.getPrecioCompra());
    BigDecimal min = compra.multiply(BigDecimal.ONE.add(MARGIN_MIN)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal max = compra.multiply(BigDecimal.ONE.add(MARGIN_MAX)).setScale(2, RoundingMode.HALF_UP);

    BigDecimal entradas = nz(entradaRepo.sumCantidadByProducto(p));
    BigDecimal salidasUnidades = nz(ventaRepo.sumCantidadByProductoAndTipos(
        p, List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.MUESTRA, TipoVenta.CASA)));
    BigDecimal pesos = nz(ventaRepo.sumCantidadByProductoAndTipo(p, TipoVenta.PESOS));
    BigDecimal equivPesos = BigDecimal.ZERO;
    if (venta.compareTo(BigDecimal.ZERO) > 0 && pesos.compareTo(BigDecimal.ZERO) > 0) {
      equivPesos = pesos.divide(venta, 4, RoundingMode.HALF_UP);
    }
    BigDecimal stock = nz(p.getCantidadInicial())
        .add(entradas)
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
