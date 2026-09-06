package com.productoslimpieza.service;

import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.EntradaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.web.dto.EntradaDto;
import com.productoslimpieza.web.dto.EntradaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
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
    return entradaRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional
  public EntradaDto crear(EntradaRequest req) {
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    Entrada e = new Entrada();
    aplicar(e, req, producto);
    Entrada saved = entradaRepo.save(e);
    if (req.actualizarPrecioCompra() && req.precioProveedor() != null) {
      producto.setPrecioCompra(req.precioProveedor());
      productoRepo.save(producto);
    }
    return toDto(saved);
  }

  @Transactional
  public EntradaDto actualizar(Long id, EntradaRequest req) {
    Entrada e = entradaRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada"));
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    aplicar(e, req, producto);
    Entrada saved = entradaRepo.save(e);
    if (req.actualizarPrecioCompra() && req.precioProveedor() != null) {
      producto.setPrecioCompra(req.precioProveedor());
      productoRepo.save(producto);
    }
    return toDto(saved);
  }

  @Transactional
  public void eliminar(Long id) {
    if (!entradaRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada no encontrada");
    }
    entradaRepo.deleteById(id);
  }

  private void aplicar(Entrada e, EntradaRequest req, Producto producto) {
    e.setFecha(req.fecha());
    e.setProducto(producto);
    e.setCantidad(req.cantidad());
    e.setPrecioProveedor(req.precioProveedor());
    if (req.precioProveedor() != null) {
      e.setTotal(req.cantidad().multiply(req.precioProveedor()).setScale(2, RoundingMode.HALF_UP));
    } else {
      e.setTotal(null);
    }
  }

  private EntradaDto toDto(Entrada e) {
    Producto p = e.getProducto();
    BigDecimal anterior = p.getPrecioCompra() != null ? p.getPrecioCompra() : BigDecimal.ZERO;
    boolean mayor = e.getPrecioProveedor() != null && e.getPrecioProveedor().compareTo(anterior) > 0;
    return new EntradaDto(
        e.getId(),
        e.getFecha(),
        p.getId(),
        p.getNombre(),
        e.getCantidad(),
        e.getPrecioProveedor(),
        e.getTotal(),
        anterior,
        mayor
    );
  }
}
