package com.productoslimpieza.service;

import com.productoslimpieza.domain.PrecioHistorico;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.PrecioHistoricoRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.web.dto.PrecioHistoricoDto;
import com.productoslimpieza.web.dto.PrecioHistoricoRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PrecioHistoricoService {

  private final PrecioHistoricoRepository precioRepo;
  private final ProductoRepository productoRepo;

  public PrecioHistoricoService(PrecioHistoricoRepository precioRepo, ProductoRepository productoRepo) {
    this.precioRepo = precioRepo;
    this.productoRepo = productoRepo;
  }

  @Transactional(readOnly = true)
  public List<PrecioHistoricoDto> listar() {
    return precioRepo.findAllByOrderByProductoNombreAscFechaVigenciaDesc().stream().map(this::toDto).toList();
  }

  @Transactional
  public PrecioHistoricoDto crear(PrecioHistoricoRequest req) {
    Producto p = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    return toDto(crearDirecto(p, req.fechaVigencia(), req.precio()));
  }

  @Transactional
  public PrecioHistorico crearDirecto(Producto producto, LocalDate fecha, BigDecimal precio) {
    PrecioHistorico ph = new PrecioHistorico();
    ph.setProducto(producto);
    ph.setFechaVigencia(fecha);
    ph.setPrecio(precio);
    return precioRepo.save(ph);
  }

  @Transactional
  public void eliminar(Long id) {
    if (!precioRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Precio no encontrado");
    }
    precioRepo.deleteById(id);
  }

  private PrecioHistoricoDto toDto(PrecioHistorico p) {
    return new PrecioHistoricoDto(
        p.getId(),
        p.getProducto().getId(),
        p.getProducto().getNombre(),
        p.getFechaVigencia(),
        p.getPrecio()
    );
  }
}
