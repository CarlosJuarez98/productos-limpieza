package com.productoslimpieza.service;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.web.dto.ApartadoDto;
import com.productoslimpieza.web.dto.ApartadoRequest;
import com.productoslimpieza.web.dto.ApartadosResumenDto;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApartadoService {

  private final ApartadoRepository apartadoRepo;

  public ApartadoService(ApartadoRepository apartadoRepo) {
    this.apartadoRepo = apartadoRepo;
  }

  @Transactional(readOnly = true)
  public ApartadosResumenDto resumen() {
    Map<CategoriaApartado, BigDecimal> totales = new EnumMap<>(CategoriaApartado.class);
    for (CategoriaApartado c : CategoriaApartado.values()) {
      totales.put(c, apartadoRepo.sumByCategoria(c));
    }
    List<ApartadoDto> movs = apartadoRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
    return new ApartadosResumenDto(totales, movs);
  }

  @Transactional
  public ApartadoDto crear(ApartadoRequest req) {
    Apartado a = new Apartado();
    a.setFecha(req.fecha());
    a.setCategoria(req.categoria());
    a.setIngreso(req.ingreso());
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
    return new ApartadoDto(a.getId(), a.getFecha(), a.getCategoria(), a.getIngreso());
  }
}
