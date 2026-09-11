package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Produccion;
import com.productoslimpieza.domain.Receta;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.ProduccionRepository;
import com.productoslimpieza.web.dto.ProduccionDto;
import com.productoslimpieza.web.dto.ProduccionRequest;
import com.productoslimpieza.web.dto.RecetaSugeridaDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProduccionService {

  private final ProduccionRepository produccionRepo;
  private final ProductoRepository productoRepo;
  private final RecetaService recetaService;

  public ProduccionService(
      ProduccionRepository produccionRepo,
      ProductoRepository productoRepo,
      RecetaService recetaService) {
    this.produccionRepo = produccionRepo;
    this.productoRepo = productoRepo;
    this.recetaService = recetaService;
  }

  @Transactional(readOnly = true)
  public List<ProduccionDto> listar() {
    return produccionRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional
  public RecetaSugeridaDto sugerir(Long productoResultadoId) {
    // Asegura semilla de Cloro/Fabuloso si aún no hay filas.
    recetaService.listar();
    Producto resultado =
        productoRepo
            .findById(productoResultadoId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    Optional<Receta> receta = recetaService.findByProductoResultadoId(productoResultadoId);
    if (receta.isEmpty()) {
      return new RecetaSugeridaDto(
          resultado.getId(), resultado.getNombre(), null, null, false, null, null, null, null);
    }
    Receta r = receta.get();
    Producto i = r.getProductoInsumo();
    BigDecimal ratio =
        nz(r.getCantidadProducto()).compareTo(BigDecimal.ZERO) > 0
            ? nz(r.getCantidadInsumo())
                .divide(nz(r.getCantidadProducto()), 8, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
    return new RecetaSugeridaDto(
        resultado.getId(),
        resultado.getNombre(),
        i.getId(),
        i.getNombre(),
        true,
        scale(r.getCantidadProducto()),
        scale(r.getCantidadAgua()),
        scale(r.getCantidadInsumo()),
        ratio);
  }

  @Transactional
  public ProduccionDto crear(ProduccionRequest req) {
    if (req.productoResultadoId().equals(req.productoInsumoId())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El resultado y el insumo no pueden ser el mismo producto");
    }
    Producto resultado =
        productoRepo
            .findById(req.productoResultadoId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Producto resultado no encontrado"));
    Producto insumo =
        productoRepo
            .findById(req.productoInsumoId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Producto insumo no encontrado"));
    if (!resultado.isActivo() || !insumo.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
    Produccion p = new Produccion();
    p.setFecha(req.fecha());
    p.setProductoResultado(resultado);
    p.setCantidadResultado(req.cantidadResultado());
    p.setProductoInsumo(insumo);
    p.setCantidadInsumo(req.cantidadInsumo());
    return toDto(produccionRepo.save(p));
  }

  @Transactional
  public ProduccionDto actualizar(Long id, ProduccionRequest req) {
    Produccion p =
        produccionRepo
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producción no encontrada"));
    if (req.productoResultadoId().equals(req.productoInsumoId())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El resultado y el insumo no pueden ser el mismo producto");
    }
    Producto resultado =
        productoRepo
            .findById(req.productoResultadoId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Producto resultado no encontrado"));
    Producto insumo =
        productoRepo
            .findById(req.productoInsumoId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Producto insumo no encontrado"));
    if (!resultado.isActivo() || !insumo.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
    p.setFecha(req.fecha());
    p.setProductoResultado(resultado);
    p.setCantidadResultado(req.cantidadResultado());
    p.setProductoInsumo(insumo);
    p.setCantidadInsumo(req.cantidadInsumo());
    return toDto(produccionRepo.save(p));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!produccionRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producción no encontrada");
    }
    produccionRepo.deleteById(id);
  }

  private ProduccionDto toDto(Produccion p) {
    Producto r = p.getProductoResultado();
    Producto i = p.getProductoInsumo();
    return new ProduccionDto(
        p.getId(),
        p.getFecha(),
        r.getId(),
        r.getNombre(),
        p.getCantidadResultado(),
        i.getId(),
        i.getNombre(),
        p.getCantidadInsumo());
  }

  private static BigDecimal scale(BigDecimal v) {
    return nz(v).setScale(4, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
