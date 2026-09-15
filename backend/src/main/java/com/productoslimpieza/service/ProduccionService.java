package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Produccion;
import com.productoslimpieza.domain.ProduccionInsumo;
import com.productoslimpieza.domain.Receta;
import com.productoslimpieza.domain.RecetaInsumo;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.ProduccionRepository;
import com.productoslimpieza.web.dto.ProduccionDto;
import com.productoslimpieza.web.dto.ProduccionInsumoDto;
import com.productoslimpieza.web.dto.ProduccionInsumoRequest;
import com.productoslimpieza.web.dto.ProduccionRequest;
import com.productoslimpieza.web.dto.RecetaInsumoDto;
import com.productoslimpieza.web.dto.RecetaSugeridaDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

  @Transactional
  public List<ProduccionDto> listar() {
    migrarInsumosLegacy();
    return produccionRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional
  public RecetaSugeridaDto sugerir(Long productoResultadoId) {
    recetaService.listar();
    Producto resultado =
        productoRepo
            .findById(productoResultadoId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    Optional<Receta> receta = recetaService.findByProductoResultadoId(productoResultadoId);
    if (receta.isEmpty()) {
      return new RecetaSugeridaDto(
          resultado.getId(),
          resultado.getNombre(),
          null,
          null,
          false,
          null,
          null,
          null,
          null,
          List.of());
    }
    Receta r = receta.get();
    List<RecetaInsumo> lineas =
        r.getInsumos() != null && !r.getInsumos().isEmpty()
            ? r.getInsumos()
            : List.of();
    List<RecetaInsumoDto> insumosDto = new ArrayList<>();
    BigDecimal totalIns = BigDecimal.ZERO;
    if (!lineas.isEmpty()) {
      for (RecetaInsumo li : lineas) {
        BigDecimal c = scale(li.getCantidad());
        totalIns = totalIns.add(c);
        insumosDto.add(
            new RecetaInsumoDto(li.getProducto().getId(), li.getProducto().getNombre(), c));
      }
    } else if (r.getProductoInsumo() != null) {
      totalIns = scale(r.getCantidadInsumo());
      insumosDto.add(
          new RecetaInsumoDto(
              r.getProductoInsumo().getId(), r.getProductoInsumo().getNombre(), totalIns));
    }
    BigDecimal ratio =
        nz(r.getCantidadProducto()).compareTo(BigDecimal.ZERO) > 0
            ? totalIns.divide(nz(r.getCantidadProducto()), 8, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
    RecetaInsumoDto primero = insumosDto.isEmpty() ? null : insumosDto.get(0);
    return new RecetaSugeridaDto(
        resultado.getId(),
        resultado.getNombre(),
        primero != null ? primero.productoInsumoId() : null,
        primero != null ? primero.productoInsumoNombre() : null,
        true,
        scale(r.getCantidadProducto()),
        scale(r.getCantidadAgua()),
        scale(totalIns),
        ratio,
        insumosDto);
  }

  @Transactional
  public ProduccionDto crear(ProduccionRequest req) {
    Produccion p = new Produccion();
    aplicar(p, req);
    return toDto(produccionRepo.save(p));
  }

  @Transactional
  public ProduccionDto actualizar(Long id, ProduccionRequest req) {
    Produccion p =
        produccionRepo
            .findById(id)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producción no encontrada"));
    aplicar(p, req);
    return toDto(produccionRepo.save(p));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!produccionRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producción no encontrada");
    }
    produccionRepo.deleteById(id);
  }

  private void aplicar(Produccion p, ProduccionRequest req) {
    List<ProduccionInsumoRequest> lineas = normalizarInsumosRequest(req);
    Producto resultado =
        productoRepo
            .findById(req.productoResultadoId())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Producto resultado no encontrado"));
    if (!resultado.isActivo()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
    }
    BigDecimal total = BigDecimal.ZERO;
    List<ProduccionInsumo> nuevas = new ArrayList<>();
    for (ProduccionInsumoRequest linea : lineas) {
      if (req.productoResultadoId().equals(linea.productoInsumoId())) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El resultado y un insumo no pueden ser el mismo producto");
      }
      Producto insumo =
          productoRepo
              .findById(linea.productoInsumoId())
              .orElseThrow(
                  () ->
                      new ResponseStatusException(
                          HttpStatus.NOT_FOUND, "Producto insumo no encontrado"));
      if (!insumo.isActivo()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El insumo «" + insumo.getNombre() + "» está dado de baja");
      }
      ProduccionInsumo pi = new ProduccionInsumo();
      pi.setProducto(insumo);
      pi.setCantidad(linea.cantidad().setScale(4, RoundingMode.HALF_UP));
      pi.setTenantId(p.getTenantId());
      nuevas.add(pi);
      total = total.add(pi.getCantidad());
    }
    p.setFecha(req.fecha());
    p.setProductoResultado(resultado);
    p.setCantidadResultado(req.cantidadResultado());
    p.setProductoInsumo(nuevas.get(0).getProducto());
    p.setCantidadInsumo(total);
    p.clearInsumos();
    for (ProduccionInsumo pi : nuevas) {
      p.addInsumo(pi);
    }
  }

  private List<ProduccionInsumoRequest> normalizarInsumosRequest(ProduccionRequest req) {
    List<ProduccionInsumoRequest> lineas = new ArrayList<>();
    if (req.insumos() != null) {
      for (ProduccionInsumoRequest i : req.insumos()) {
        if (i == null || i.productoInsumoId() == null || i.cantidad() == null) continue;
        if (i.cantidad().compareTo(BigDecimal.ZERO) <= 0) continue;
        lineas.add(i);
      }
    }
    if (lineas.isEmpty() && req.productoInsumoId() != null && req.cantidadInsumo() != null) {
      lineas.add(new ProduccionInsumoRequest(req.productoInsumoId(), req.cantidadInsumo()));
    }
    if (lineas.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica al menos un insumo");
    }
    Map<Long, BigDecimal> unidos = new LinkedHashMap<>();
    for (ProduccionInsumoRequest i : lineas) {
      unidos.merge(
          i.productoInsumoId(),
          i.cantidad().setScale(4, RoundingMode.HALF_UP),
          BigDecimal::add);
    }
    return unidos.entrySet().stream()
        .map(e -> new ProduccionInsumoRequest(e.getKey(), e.getValue()))
        .toList();
  }

  @Transactional
  protected void migrarInsumosLegacy() {
    for (Produccion p : produccionRepo.findAllByOrderByFechaDescIdDesc()) {
      if (p.getInsumos() != null && !p.getInsumos().isEmpty()) continue;
      if (p.getProductoInsumo() == null || p.getCantidadInsumo() == null) continue;
      ProduccionInsumo pi = new ProduccionInsumo();
      pi.setProducto(p.getProductoInsumo());
      pi.setCantidad(p.getCantidadInsumo());
      pi.setTenantId(p.getTenantId());
      p.addInsumo(pi);
      produccionRepo.save(p);
    }
  }

  private ProduccionDto toDto(Produccion p) {
    Producto r = p.getProductoResultado();
    List<ProduccionInsumoDto> insumos;
    if (p.getInsumos() != null && !p.getInsumos().isEmpty()) {
      insumos =
          p.getInsumos().stream()
              .map(
                  i ->
                      new ProduccionInsumoDto(
                          i.getProducto().getId(),
                          i.getProducto().getNombre(),
                          i.getCantidad()))
              .toList();
    } else {
      Producto i = p.getProductoInsumo();
      insumos =
          i == null
              ? List.of()
              : List.of(new ProduccionInsumoDto(i.getId(), i.getNombre(), p.getCantidadInsumo()));
    }
    ProduccionInsumoDto primero = insumos.isEmpty() ? null : insumos.get(0);
    BigDecimal total =
        insumos.stream()
            .map(ProduccionInsumoDto::cantidad)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return new ProduccionDto(
        p.getId(),
        p.getFecha(),
        r.getId(),
        r.getNombre(),
        p.getCantidadResultado(),
        primero != null ? primero.productoInsumoId() : null,
        primero != null ? primero.productoInsumoNombre() : null,
        total.compareTo(BigDecimal.ZERO) > 0 ? total : p.getCantidadInsumo(),
        insumos);
  }

  private static BigDecimal scale(BigDecimal v) {
    return nz(v).setScale(4, RoundingMode.HALF_UP);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
