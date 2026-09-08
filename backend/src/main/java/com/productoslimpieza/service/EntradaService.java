package com.productoslimpieza.service;

import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.web.dto.EntradaDto;
import com.productoslimpieza.web.dto.EntradaLineaRequest;
import com.productoslimpieza.web.dto.EntradaRequest;
import com.productoslimpieza.web.dto.EntradasLoteRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EntradaService {

  private final EntradaRepository entradaRepo;
  private final ProductoRepository productoRepo;

  public EntradaService(EntradaRepository entradaRepo, ProductoRepository productoRepo) {
    this.entradaRepo = entradaRepo;
    this.productoRepo = productoRepo;
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
    BigDecimal anterior = ultimaCompraProducto(producto.getId());
    Entrada e = new Entrada();
    aplicar(e, req.fecha(), producto, req.cantidad(), req.precioProveedor());
    Entrada saved = entradaRepo.save(e);
    if (req.actualizarPrecioCompra() && req.precioProveedor() != null) {
      producto.setPrecioCompra(req.precioProveedor());
      productoRepo.save(producto);
    }
    return toDto(saved, anterior);
  }

  @Transactional
  public List<EntradaDto> crearLote(EntradasLoteRequest req) {
    if (req.lineas() == null || req.lineas().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un producto");
    }
    List<EntradaDto> out = new ArrayList<>();
    Map<Long, BigDecimal> ultimaEnLote = new HashMap<>();
    for (EntradaLineaRequest linea : req.lineas()) {
      Producto producto = productoRepo.findById(linea.productoId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
      exigirActivo(producto);
      BigDecimal anterior = ultimaEnLote.containsKey(producto.getId())
          ? ultimaEnLote.get(producto.getId())
          : ultimaCompraProducto(producto.getId());
      Entrada e = new Entrada();
      aplicar(e, req.fecha(), producto, linea.cantidad(), linea.precioProveedor());
      Entrada saved = entradaRepo.save(e);
      if (req.actualizarPrecioCompra() && linea.precioProveedor() != null) {
        producto.setPrecioCompra(linea.precioProveedor());
        productoRepo.save(producto);
      }
      if (linea.precioProveedor() != null) {
        ultimaEnLote.put(producto.getId(), linea.precioProveedor());
      }
      out.add(toDto(saved, anterior));
    }
    return out;
  }

  @Transactional
  public EntradaDto actualizar(Long id, EntradaRequest req) {
    Entrada e = entradaRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada"));
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    exigirActivo(producto);
    aplicar(e, req.fecha(), producto, req.cantidad(), req.precioProveedor());
    Entrada saved = entradaRepo.save(e);
    if (req.actualizarPrecioCompra() && req.precioProveedor() != null) {
      producto.setPrecioCompra(req.precioProveedor());
      productoRepo.save(producto);
    }
    BigDecimal anterior = ultimaCompraAntesDe(saved);
    return toDto(saved, anterior);
  }

  @Transactional
  public void eliminar(Long id) {
    if (!entradaRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada");
    }
    entradaRepo.deleteById(id);
  }

  private void exigirActivo(Producto producto) {
    if (!producto.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
  }

  private void aplicar(
      Entrada e,
      java.time.LocalDate fecha,
      Producto producto,
      BigDecimal cantidad,
      BigDecimal precioProveedor) {
    if (fecha != null && fecha.isAfter(java.time.LocalDate.now())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se permiten fechas futuras");
    }
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

  /** Recorre cronológico ascendente y guarda el precio de la compra previa por producto. */
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
        menor
    );
  }
}
