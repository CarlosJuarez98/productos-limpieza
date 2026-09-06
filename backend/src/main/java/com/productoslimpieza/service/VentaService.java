package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.VentaDto;
import com.productoslimpieza.web.dto.VentaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VentaService {

  private final VentaRepository ventaRepo;
  private final ProductoRepository productoRepo;
  private final PrecioService precioService;

  public VentaService(VentaRepository ventaRepo, ProductoRepository productoRepo, PrecioService precioService) {
    this.ventaRepo = ventaRepo;
    this.productoRepo = productoRepo;
    this.precioService = precioService;
  }

  @Transactional(readOnly = true)
  public List<VentaDto> listar(LocalDate desde, LocalDate hasta) {
    List<Venta> ventas = (desde != null && hasta != null)
        ? ventaRepo.findByFechaBetweenOrderByFechaDescIdDesc(desde, hasta)
        : ventaRepo.findAllByOrderByFechaDescIdDesc();
    return ventas.stream().map(this::toDto).toList();
  }

  @Transactional
  public VentaDto crear(VentaRequest req) {
    Venta v = new Venta();
    aplicar(v, req);
    return toDto(ventaRepo.save(v));
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

  public BigDecimal calcularTotal(TipoVenta tipo, BigDecimal cantidad, Producto producto, LocalDate fecha) {
    if (tipo.totalEsCero()) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    if (tipo.totalEsCantidad()) {
      return cantidad.setScale(2, RoundingMode.HALF_UP);
    }
    if (producto == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido para este tipo de venta");
    }
    BigDecimal precio = precioService.precioVigente(producto, fecha);
    return cantidad.multiply(precio).setScale(2, RoundingMode.HALF_UP);
  }

  private void aplicar(Venta v, VentaRequest req) {
    TipoVenta tipo = req.tipoVenta();
    Producto producto = null;
    if (tipo.esProducto()) {
      if (req.productoId() == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto requerido");
      }
      producto = productoRepo.findById(req.productoId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    }
    v.setFecha(req.fecha());
    v.setProducto(producto);
    v.setTipoVenta(tipo);
    v.setCantidad(req.cantidad());
    v.setTotal(calcularTotal(tipo, req.cantidad(), producto, req.fecha()));
  }

  private VentaDto toDto(Venta v) {
    Producto p = v.getProducto();
    return new VentaDto(
        v.getId(),
        v.getFecha(),
        p != null ? p.getId() : null,
        p != null ? p.getNombre() : null,
        v.getTipoVenta(),
        v.getTipoVenta().toExcel(),
        v.getCantidad(),
        v.getTotal()
    );
  }
}
