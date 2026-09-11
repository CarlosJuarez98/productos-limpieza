package com.productoslimpieza.service;

import com.productoslimpieza.domain.AjusteInventario;
import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.AjusteInventarioRepository;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.AjusteInventarioDto;
import com.productoslimpieza.web.dto.AjusteInventarioRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AjusteInventarioService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final AjusteInventarioRepository ajusteRepo;
  private final ProductoRepository productoRepo;
  private final CajaConfigRepository cajaConfigRepo;

  public AjusteInventarioService(
      AjusteInventarioRepository ajusteRepo,
      ProductoRepository productoRepo,
      CajaConfigRepository cajaConfigRepo) {
    this.ajusteRepo = ajusteRepo;
    this.productoRepo = productoRepo;
    this.cajaConfigRepo = cajaConfigRepo;
  }

  @Transactional(readOnly = true)
  public List<AjusteInventarioDto> listar() {
    return ajusteRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
  }

  @Transactional
  public AjusteInventarioDto crear(AjusteInventarioRequest req) {
    AjusteInventario a = new AjusteInventario();
    aplicar(a, req);
    return toDto(ajusteRepo.save(a));
  }

  @Transactional
  public AjusteInventarioDto actualizar(Long id, AjusteInventarioRequest req) {
    AjusteInventario a = ajusteRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ajuste no encontrado"));
    aplicar(a, req);
    return toDto(ajusteRepo.save(a));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!ajusteRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ajuste no encontrado");
    }
    ajusteRepo.deleteById(id);
  }

  private void aplicar(AjusteInventario a, AjusteInventarioRequest req) {
    validarFechaPermitida(req.fecha());
    BigDecimal cant = req.cantidad();
    if (cant == null || cant.compareTo(BigDecimal.ZERO) == 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "La cantidad del ajuste no puede ser 0");
    }
    String motivo = req.motivo() != null ? req.motivo().trim() : "";
    if (motivo.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Motivo requerido");
    }
    if (motivo.length() > 200) {
      motivo = motivo.substring(0, 200);
    }
    Producto producto = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    if (!producto.isActivo()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto inactivo");
    }
    a.setFecha(req.fecha());
    a.setProducto(producto);
    a.setCantidad(cant);
    a.setMotivo(motivo);
  }

  private void validarFechaPermitida(LocalDate fecha) {
    if (fecha == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha requerida");
    }
    LocalDate hoy = LocalDate.now(ZONA);
    if (fecha.isAfter(hoy)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se permiten fechas futuras");
    }
    LocalDate inicioPeriodo = cajaConfigRepo.findByTenantId(TenantContext.require())
        .map(CajaConfig::getFechaInicio)
        .orElse(null);
    if (inicioPeriodo != null && fecha.isBefore(inicioPeriodo)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No se pueden registrar ajustes antes del periodo de caja actual (" + inicioPeriodo + ")");
    }
  }

  private AjusteInventarioDto toDto(AjusteInventario a) {
    Producto p = a.getProducto();
    return new AjusteInventarioDto(
        a.getId(),
        a.getFecha(),
        p.getId(),
        p.getNombre(),
        a.getCantidad(),
        a.getMotivo());
  }
}
