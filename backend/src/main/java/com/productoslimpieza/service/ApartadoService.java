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
import java.util.HashMap;
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
  private final CajaService cajaService;

  public ApartadoService(
      ApartadoRepository apartadoRepo, ApartadoRubroService rubroService, CajaService cajaService) {
    this.apartadoRepo = apartadoRepo;
    this.rubroService = rubroService;
    this.cajaService = cajaService;
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
    Map<String, BigDecimal> gastadoEnLote = new HashMap<>();
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
      if (tipo == TipoMovimientoApartado.GASTO) {
        BigDecimal saldo =
            nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.INGRESO))
                .subtract(nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.GASTO)))
                .subtract(gastadoEnLote.getOrDefault(codigo.toLowerCase(Locale.ROOT), BigDecimal.ZERO));
        if (linea.ingreso().compareTo(saldo) > 0) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST,
              "En "
                  + codigo
                  + " no hay suficiente ($"
                  + saldo.setScale(2, RoundingMode.HALF_UP)
                  + ")");
        }
        gastadoEnLote.merge(
            codigo.toLowerCase(Locale.ROOT), linea.ingreso(), BigDecimal::add);
      }
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
  public ApartadoDto actualizar(Long id, ApartadoRequest req) {
    Apartado a =
        apartadoRepo
            .findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Apartado no encontrado"));
    if (req.fecha() != null && req.fecha().isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser posterior a hoy");
    }
    if (req.ingreso() == null || req.ingreso().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto debe ser mayor a 0");
    }
    TipoMovimientoApartado tipo = a.getTipo() != null ? a.getTipo() : TipoMovimientoApartado.INGRESO;
    if (tipo == TipoMovimientoApartado.GASTO && (req.motivo() == null || req.motivo().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo del gasto");
    }
    String codigo = resolverCodigo(req.categoria());
    rubroService.exigirRubroUsable(codigo);

    if (tipo == TipoMovimientoApartado.GASTO) {
      BigDecimal saldoDestino =
          nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.INGRESO))
              .subtract(nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.GASTO)));
      if (codigo.equalsIgnoreCase(a.getCategoria()) && a.getTipo() == TipoMovimientoApartado.GASTO) {
        saldoDestino = saldoDestino.add(nz(a.getIngreso()));
      }
      if (req.ingreso().compareTo(saldoDestino) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "En ese apartado no hay suficiente ($" + saldoDestino.setScale(2, RoundingMode.HALF_UP) + ")");
      }
    }

    if (tipo == TipoMovimientoApartado.INGRESO) {
      var caja = cajaService.resumen();
      BigDecimal disp = nz(caja.disponibleParaApartar());
      List<String> catsCorte = rubroService.codigosLiquidaCorte();
      boolean oldCuenta = cuentaEnCajaPeriodo(a, caja.fechaInicio(), caja.fechaFin(), catsCorte);
      boolean newCuenta =
          catsCorte.stream().anyMatch(c -> c.equalsIgnoreCase(codigo))
              && enPeriodo(req.fecha(), caja.fechaInicio(), caja.fechaFin());
      BigDecimal extra = BigDecimal.ZERO;
      if (newCuenta) extra = extra.add(req.ingreso());
      if (oldCuenta) extra = extra.subtract(nz(a.getIngreso()));
      if (extra.compareTo(disp) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "No hay tanto disponible para apartar ($" + disp.setScale(2, RoundingMode.HALF_UP) + ")");
      }
    }

    a.setFecha(req.fecha());
    a.setCategoria(codigo);
    a.setIngreso(req.ingreso().setScale(2, RoundingMode.HALF_UP));
    a.setMotivo(req.motivo() == null || req.motivo().isBlank() ? null : req.motivo().trim());
    return toDto(apartadoRepo.save(a));
  }

  private String resolverCodigo(String categoria) {
    Map<String, String> codigos =
        rubroService.listarActivos().stream()
            .collect(
                Collectors.toMap(
                    r -> r.codigo().toLowerCase(Locale.ROOT),
                    ApartadoRubroDto::codigo,
                    (x, y) -> x,
                    LinkedHashMap::new));
    String key = categoria == null ? "" : categoria.trim().toLowerCase(Locale.ROOT);
    String codigo = codigos.get(key);
    if (codigo == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No existe el apartado " + categoria);
    }
    return codigo;
  }

  private static boolean cuentaEnCajaPeriodo(
      Apartado a, LocalDate desde, LocalDate hasta, List<String> catsCorte) {
    TipoMovimientoApartado tipo = a.getTipo() != null ? a.getTipo() : TipoMovimientoApartado.INGRESO;
    if (tipo != TipoMovimientoApartado.INGRESO) return false;
    if (a.getCategoria() == null
        || catsCorte.stream().noneMatch(c -> c.equalsIgnoreCase(a.getCategoria()))) {
      return false;
    }
    return enPeriodo(a.getFecha(), desde, hasta);
  }

  private static boolean enPeriodo(LocalDate fecha, LocalDate desde, LocalDate hasta) {
    if (fecha == null) return false;
    if (desde != null && fecha.isBefore(desde)) return false;
    if (hasta != null && fecha.isAfter(hasta)) return false;
    return true;
  }

  @Transactional(readOnly = true)
  public BigDecimal saldoCategoria(String categoria) {
    String codigo = resolverCodigo(categoria);
    return nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.INGRESO))
        .subtract(nz(apartadoRepo.sumByCategoriaAndTipo(codigo, TipoMovimientoApartado.GASTO)))
        .setScale(2, RoundingMode.HALF_UP);
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
