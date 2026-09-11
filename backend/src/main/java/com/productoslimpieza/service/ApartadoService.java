package com.productoslimpieza.service;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.web.dto.ApartadoDto;
import com.productoslimpieza.web.dto.ApartadoLineaLoteRequest;
import com.productoslimpieza.web.dto.ApartadoRequest;
import com.productoslimpieza.web.dto.ApartadoRubroDto;
import com.productoslimpieza.web.dto.ApartadosLoteRequest;
import com.productoslimpieza.web.dto.ApartadosResumenDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApartadoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final ApartadoRepository apartadoRepo;
  private final ApartadoRubroService rubroService;

  public ApartadoService(ApartadoRepository apartadoRepo, ApartadoRubroService rubroService) {
    this.apartadoRepo = apartadoRepo;
    this.rubroService = rubroService;
  }

  @Transactional
  public ApartadosResumenDto resumen() {
    List<ApartadoRubroDto> rubros = rubroService.listarActivos();
    Map<String, BigDecimal> ingresos = new LinkedHashMap<>();
    Map<String, BigDecimal> gastos = new LinkedHashMap<>();
    Map<String, BigDecimal> saldos = new LinkedHashMap<>();

    BigDecimal general = BigDecimal.ZERO;
    for (ApartadoRubroDto r : rubros) {
      BigDecimal ing = nz(apartadoRepo.sumByCategoriaAndTipo(r.codigo(), TipoMovimientoApartado.INGRESO));
      BigDecimal gas = nz(apartadoRepo.sumByCategoriaAndTipo(r.codigo(), TipoMovimientoApartado.GASTO));
      ingresos.put(r.codigo(), ing.setScale(2, RoundingMode.HALF_UP));
      gastos.put(r.codigo(), gas.setScale(2, RoundingMode.HALF_UP));
      BigDecimal saldo = ing.subtract(gas).setScale(2, RoundingMode.HALF_UP);
      saldos.put(r.codigo(), saldo);
      if (r.liquidaCorte()) {
        general = general.add(saldo);
      }
    }
    saldos.put(CategoriaApartado.GENERAL.name(), general.setScale(2, RoundingMode.HALF_UP));
    ingresos.put(CategoriaApartado.GENERAL.name(), BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
    gastos.put(CategoriaApartado.GENERAL.name(), BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));

    List<ApartadoDto> movs =
        apartadoRepo.findAllByOrderByFechaDescIdDesc().stream()
            .filter(
                a ->
                    a.getCategoria() != null
                        && !CategoriaApartado.GENERAL.name().equalsIgnoreCase(a.getCategoria())
                        && !CategoriaApartado.SERVICIOS.name().equalsIgnoreCase(a.getCategoria()))
            .map(this::toDto)
            .toList();
    return new ApartadosResumenDto(rubros, saldos, ingresos, gastos, movs);
  }

  @Transactional
  public ApartadoDto crear(ApartadoRequest req) {
    return crearLote(
            new ApartadosLoteRequest(
                req.fecha(),
                List.of(
                    new ApartadoLineaLoteRequest(
                        req.categoria(), req.ingreso(), req.tipo(), req.motivo()))))
        .get(0);
  }

  @Transactional
  public List<ApartadoDto> crearLote(ApartadosLoteRequest req) {
    if (req.lineas() == null || req.lineas().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un movimiento");
    }
    if (req.fecha() != null && req.fecha().isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser posterior a hoy");
    }
    Map<String, String> codigos =
        rubroService.listarActivos().stream()
            .collect(
                Collectors.toMap(
                    r -> r.codigo().toLowerCase(Locale.ROOT),
                    ApartadoRubroDto::codigo,
                    (a, b) -> a,
                    LinkedHashMap::new));

    List<Apartado> aGuardar = new ArrayList<>(req.lineas().size());
    for (ApartadoLineaLoteRequest linea : req.lineas()) {
      TipoMovimientoApartado tipo =
          linea.tipo() != null ? linea.tipo() : TipoMovimientoApartado.INGRESO;
      if (tipo == TipoMovimientoApartado.GASTO
          && (linea.motivo() == null || linea.motivo().isBlank())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo del gasto");
      }
      if (linea.ingreso() == null || linea.ingreso().compareTo(BigDecimal.ZERO) <= 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto debe ser mayor a 0");
      }
      String key = linea.categoria() == null ? "" : linea.categoria().trim().toLowerCase(Locale.ROOT);
      String codigo = codigos.get(key);
      if (codigo == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "No existe el apartado " + linea.categoria());
      }
      rubroService.exigirRubroUsable(codigo);
      Apartado a = new Apartado();
      a.setFecha(req.fecha());
      a.setCategoria(codigo);
      a.setIngreso(linea.ingreso());
      a.setTipo(tipo);
      a.setMotivo(linea.motivo());
      aGuardar.add(a);
    }
    return apartadoRepo.saveAll(aGuardar).stream().map(this::toDto).toList();
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
