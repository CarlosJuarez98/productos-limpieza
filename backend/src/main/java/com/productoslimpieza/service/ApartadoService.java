package com.productoslimpieza.service;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.web.dto.ApartadoDto;
import com.productoslimpieza.web.dto.ApartadoRequest;
import com.productoslimpieza.web.dto.ApartadosResumenDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApartadoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final ApartadoRepository apartadoRepo;

  public ApartadoService(ApartadoRepository apartadoRepo) {
    this.apartadoRepo = apartadoRepo;
  }

  @Transactional(readOnly = true)
  public ApartadosResumenDto resumen() {
    Map<CategoriaApartado, BigDecimal> ingresos = new EnumMap<>(CategoriaApartado.class);
    Map<CategoriaApartado, BigDecimal> gastos = new EnumMap<>(CategoriaApartado.class);
    Map<CategoriaApartado, BigDecimal> saldos = new EnumMap<>(CategoriaApartado.class);
    for (CategoriaApartado c : CategoriaApartado.values()) {
      if (c == CategoriaApartado.GENERAL) {
        continue;
      }
      BigDecimal ing = nz(apartadoRepo.sumByCategoriaAndTipo(c, TipoMovimientoApartado.INGRESO));
      BigDecimal gas = nz(apartadoRepo.sumByCategoriaAndTipo(c, TipoMovimientoApartado.GASTO));
      ingresos.put(c, ing.setScale(2, RoundingMode.HALF_UP));
      gastos.put(c, gas.setScale(2, RoundingMode.HALF_UP));
      saldos.put(c, ing.subtract(gas).setScale(2, RoundingMode.HALF_UP));
    }
    // General = productos + casa + salarios (como Excel; sin servicios)
    BigDecimal general = saldos.getOrDefault(CategoriaApartado.PRODUCTOS, BigDecimal.ZERO)
        .add(saldos.getOrDefault(CategoriaApartado.CASA, BigDecimal.ZERO))
        .add(saldos.getOrDefault(CategoriaApartado.SALARIOS, BigDecimal.ZERO))
        .setScale(2, RoundingMode.HALF_UP);
    saldos.put(CategoriaApartado.GENERAL, general);
    ingresos.put(CategoriaApartado.GENERAL, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
    gastos.put(CategoriaApartado.GENERAL, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));

    List<ApartadoDto> movs = apartadoRepo.findAllByOrderByFechaDescIdDesc().stream()
        .filter(a -> a.getCategoria() != CategoriaApartado.GENERAL
            && a.getCategoria() != CategoriaApartado.SERVICIOS)
        .map(this::toDto)
        .toList();
    return new ApartadosResumenDto(saldos, ingresos, gastos, movs);
  }

  @Transactional
  public ApartadoDto crear(ApartadoRequest req) {
    if (req.categoria() == CategoriaApartado.GENERAL) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Apartados general es la suma de productos + casa + salarios");
    }
    // SERVICIOS solo se usa en Caja (columna Apartados servicios); permitido crear.
    TipoMovimientoApartado tipo = req.tipo() != null ? req.tipo() : TipoMovimientoApartado.INGRESO;
    if (tipo == TipoMovimientoApartado.GASTO && (req.motivo() == null || req.motivo().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo del gasto");
    }
    if (req.ingreso() == null || req.ingreso().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto debe ser mayor a 0");
    }
    if (req.fecha() != null && req.fecha().isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser posterior a hoy");
    }
    Apartado a = new Apartado();
    a.setFecha(req.fecha());
    a.setCategoria(req.categoria());
    a.setIngreso(req.ingreso());
    a.setTipo(tipo);
    a.setMotivo(req.motivo());
    return toDto(apartadoRepo.save(a));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!apartadoRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Apartado no encontrado");
    }
    apartadoRepo.deleteById(id);
  }

  private ApartadoDto toDto(Apartado a) {
    TipoMovimientoApartado tipo = a.getTipo() != null ? a.getTipo() : TipoMovimientoApartado.INGRESO;
    return new ApartadoDto(a.getId(), a.getFecha(), a.getCategoria(), a.getIngreso(), tipo, a.getMotivo());
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
