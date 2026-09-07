package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.CategoriaApartado;
import com.productoslimpieza.domain.CorteCaja;
import com.productoslimpieza.domain.MovimientoCaja;
import com.productoslimpieza.domain.TipoMovimientoCaja;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.repo.ApartadoRepository;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.CorteCajaRepository;
import com.productoslimpieza.repo.MovimientoCajaRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.CajaConfigRequest;
import com.productoslimpieza.web.dto.CajaResumenDto;
import com.productoslimpieza.web.dto.MarcarCorteRequest;
import com.productoslimpieza.web.dto.MovimientoCajaDto;
import com.productoslimpieza.web.dto.MovimientoCajaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CajaService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
  private static final BigDecimal FONDO_DEFAULT = new BigDecimal("200.00");

  private final CajaConfigRepository configRepo;
  private final MovimientoCajaRepository movimientoRepo;
  private final VentaRepository ventaRepo;
  private final ApartadoRepository apartadoRepo;
  private final CorteCajaRepository corteRepo;

  public CajaService(
      CajaConfigRepository configRepo,
      MovimientoCajaRepository movimientoRepo,
      VentaRepository ventaRepo,
      ApartadoRepository apartadoRepo,
      CorteCajaRepository corteRepo) {
    this.configRepo = configRepo;
    this.movimientoRepo = movimientoRepo;
    this.ventaRepo = ventaRepo;
    this.apartadoRepo = apartadoRepo;
    this.corteRepo = corteRepo;
  }

  @Transactional(readOnly = true)
  public CajaResumenDto resumen() {
    CajaConfig cfg = getOrCreateConfig();
    LocalDate desde = cfg.getFechaInicio() != null ? cfg.getFechaInicio() : LocalDate.of(2000, 1, 1);
    LocalDate hasta = cfg.getFechaFin() != null ? cfg.getFechaFin() : LocalDate.now(ZONA);

    BigDecimal productos = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta,
        List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.PESOS, TipoVenta.MAYOREO,
            TipoVenta.CASA, TipoVenta.MUESTRA)));
    BigDecimal recargas = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.RECARGA)));
    BigDecimal servicios = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.PAGO_DE_SERVICIOS)));

    BigDecimal retiros = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.RETIRO, desde, hasta));
    BigDecimal ingresos = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.INGRESO, desde, hasta));
    BigDecimal retirosTx = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.RETIRO_TRANSFERENCIA, desde, hasta));
    BigDecimal transferencias = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.TRANSFERENCIA, desde, hasta));

    BigDecimal apartadosProductos = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        List.of(CategoriaApartado.PRODUCTOS, CategoriaApartado.CASA, CategoriaApartado.SALARIOS),
        desde, hasta));
    BigDecimal apartadosServicios = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        List.of(CategoriaApartado.SERVICIOS), desde, hasta));

    BigDecimal fondo = nz(cfg.getFondoInicial());

    BigDecimal totalCaja = fondo
        .add(productos).add(recargas).add(servicios).add(ingresos)
        .subtract(retiros)
        .subtract(transferencias)
        .subtract(apartadosProductos)
        .subtract(apartadosServicios)
        .setScale(2, RoundingMode.HALF_UP);

    BigDecimal totalTx = transferencias.subtract(retirosTx).setScale(2, RoundingMode.HALF_UP);
    BigDecimal totalNegocio = totalCaja.add(totalTx).setScale(2, RoundingMode.HALF_UP);

    List<LocalDate> fechasCorte = corteRepo.findAllByOrderByFechaAsc().stream()
        .map(CorteCaja::getFecha)
        .toList();
    LocalDate ultimoCorte = corteRepo.findMaxFecha().orElseGet(() ->
        cfg.getFechaInicio() != null ? cfg.getFechaInicio().minusDays(1) : null);

    return new CajaResumenDto(
        cfg.getFechaInicio(),
        cfg.getFechaFin(),
        fondo,
        productos.setScale(2, RoundingMode.HALF_UP),
        recargas.setScale(2, RoundingMode.HALF_UP),
        servicios.setScale(2, RoundingMode.HALF_UP),
        retiros.setScale(2, RoundingMode.HALF_UP),
        ingresos.setScale(2, RoundingMode.HALF_UP),
        retirosTx.setScale(2, RoundingMode.HALF_UP),
        transferencias.setScale(2, RoundingMode.HALF_UP),
        apartadosProductos.setScale(2, RoundingMode.HALF_UP),
        apartadosServicios.setScale(2, RoundingMode.HALF_UP),
        totalCaja,
        totalTx,
        totalNegocio,
        fechasCorte,
        ultimoCorte,
        mapMovs(TipoMovimientoCaja.RETIRO, desde, hasta),
        mapMovs(TipoMovimientoCaja.INGRESO, desde, hasta),
        mapMovs(TipoMovimientoCaja.RETIRO_TRANSFERENCIA, desde, hasta),
        mapMovs(TipoMovimientoCaja.TRANSFERENCIA, desde, hasta)
    );
  }

  @Transactional
  public CajaConfig actualizarConfig(CajaConfigRequest req) {
    CajaConfig cfg = getOrCreateConfig();
    if (req.fechaInicio() != null) cfg.setFechaInicio(req.fechaInicio());
    if (req.fechaFin() != null) cfg.setFechaFin(req.fechaFin());
    if (req.fondoInicial() != null) cfg.setFondoInicial(req.fondoInicial());
    return configRepo.save(cfg);
  }

  /**
   * Registra un corte (como fecha naranja en Excel). El periodo nuevo empieza al día siguiente.
   */
  @Transactional
  public CajaConfig marcarCorte(MarcarCorteRequest req) {
    LocalDate corte = req.fechaCorte();
    if (corte == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica la fecha del corte");
    }
    if (corte.isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se puede marcar un corte futuro");
    }
    if (!corteRepo.existsByFecha(corte)) {
      CorteCaja c = new CorteCaja();
      c.setFecha(corte);
      corteRepo.save(c);
    }
    LocalDate inicio = corte.plusDays(1);
    LocalDate hoy = LocalDate.now(ZONA);
    LocalDate fin = hoy.isBefore(inicio) ? inicio : hoy;
    BigDecimal fondo = req.fondoInicial() != null ? req.fondoInicial() : FONDO_DEFAULT;

    CajaConfig cfg = getOrCreateConfig();
    cfg.setFechaInicio(inicio);
    cfg.setFechaFin(fin);
    cfg.setFondoInicial(fondo);
    return configRepo.save(cfg);
  }

  @Transactional
  public MovimientoCajaDto crearMovimiento(MovimientoCajaRequest req) {
    MovimientoCaja m = new MovimientoCaja();
    m.setFecha(req.fecha());
    m.setTipo(req.tipo());
    m.setMonto(req.monto());
    m.setMotivo(req.motivo());
    return toDto(movimientoRepo.save(m));
  }

  @Transactional
  public void eliminarMovimiento(Long id) {
    if (!movimientoRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimiento no encontrado");
    }
    movimientoRepo.deleteById(id);
  }

  private List<MovimientoCajaDto> mapMovs(TipoMovimientoCaja tipo, LocalDate desde, LocalDate hasta) {
    return movimientoRepo.findByTipoAndFechaBetweenOrderByFechaDescIdDesc(tipo, desde, hasta)
        .stream().map(this::toDto).toList();
  }

  private MovimientoCajaDto toDto(MovimientoCaja m) {
    return new MovimientoCajaDto(m.getId(), m.getFecha(), m.getTipo(), m.getMonto(), m.getMotivo());
  }

  private CajaConfig getOrCreateConfig() {
    return configRepo.findById(1L).orElseGet(() -> {
      CajaConfig c = new CajaConfig();
      c.setId(1L);
      c.setFondoInicial(FONDO_DEFAULT);
      return configRepo.save(c);
    });
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
