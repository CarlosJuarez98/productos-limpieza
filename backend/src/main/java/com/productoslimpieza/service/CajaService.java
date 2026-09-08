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
import com.productoslimpieza.web.dto.CortePeriodoDto;
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
  /** Fondo del primer periodo, antes del primer corte. */
  private static final BigDecimal FONDO_HISTORICO = new BigDecimal("790.00");
  private static final LocalDate INICIO_HISTORICO = LocalDate.of(2025, 10, 29);

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
    Totales t = calcularTotales(desde, hasta, nz(cfg.getFondoInicial()));

    List<LocalDate> fechasCorte = corteRepo.findAllByOrderByFechaAsc().stream()
        .map(CorteCaja::getFecha)
        .toList();
    LocalDate ultimoCorte = corteRepo.findMaxFecha().orElseGet(() ->
        cfg.getFechaInicio() != null ? cfg.getFechaInicio().minusDays(1) : null);

    BigDecimal disponibleApartar = calcularDisponibleParaApartar(cfg, t, desde, hasta);

    return new CajaResumenDto(
        cfg.getFechaInicio(),
        cfg.getFechaFin(),
        t.fondo,
        t.productos,
        t.recargas,
        t.servicios,
        t.retiros,
        t.ingresos,
        t.retirosTx,
        t.transferencias,
        t.apartadosProductos,
        t.apartadosServicios,
        t.totalCaja,
        t.totalTx,
        t.totalNegocio,
        fechasCorte,
        ultimoCorte,
        disponibleApartar,
        mapMovs(TipoMovimientoCaja.RETIRO, desde, hasta),
        mapMovs(TipoMovimientoCaja.INGRESO, desde, hasta),
        mapMovs(TipoMovimientoCaja.RETIRO_TRANSFERENCIA, desde, hasta),
        mapMovs(TipoMovimientoCaja.TRANSFERENCIA, desde, hasta)
    );
  }

  /**
   * Tras un corte: lo apartable = (contado − fondo $200) − ya apartado en el periodo nuevo.
   * Las ventas del periodo nuevo no aumentan el disponible hasta el siguiente corte.
   */
  private BigDecimal calcularDisponibleParaApartar(
      CajaConfig cfg, Totales tPeriodo, LocalDate desdePeriodo, LocalDate hastaPeriodo) {
    BigDecimal fondo = nz(cfg.getFondoInicial());
    if (fondo.compareTo(BigDecimal.ZERO) <= 0) {
      fondo = FONDO_DEFAULT;
    }
    var ultimoOpt = corteRepo.findMaxFecha().flatMap(corteRepo::findByFecha);
    if (ultimoOpt.isEmpty()) {
      return tPeriodo.totalCaja.subtract(fondo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
    CorteCaja ultimo = ultimoOpt.get();
    BigDecimal aApartarDelCorte = montoParaApartar(ultimo, fondo);
    List<CategoriaApartado> cats = List.of(
        CategoriaApartado.PRODUCTOS, CategoriaApartado.CASA, CategoriaApartado.SALARIOS);
    BigDecimal apartadosNuevos = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        cats, desdePeriodo, hastaPeriodo));
    return aApartarDelCorte
        .subtract(apartadosNuevos)
        .max(BigDecimal.ZERO)
        .setScale(2, RoundingMode.HALF_UP);
  }

  /** Contado − fondo que queda (siempre recalculado). */
  private BigDecimal montoParaApartar(CorteCaja corte, BigDecimal fondoQueQueda) {
    return contadoDelCorte(corte)
        .subtract(fondoQueQueda)
        .max(BigDecimal.ZERO)
        .setScale(2, RoundingMode.HALF_UP);
  }

  private BigDecimal contadoDelCorte(CorteCaja corte) {
    BigDecimal caja = nz(corte.getTotalCaja());
    BigDecimal calc =
        corte.getTotalCalculadora() != null
                && corte.getTotalCalculadora().compareTo(BigDecimal.ZERO) > 0
            ? corte.getTotalCalculadora()
            : BigDecimal.ZERO;
    return calc.max(caja);
  }

  /** Completa / corrige paraApartar en cortes (contado − fondo). */
  @Transactional
  public void normalizarParaApartarCortes(BigDecimal fondoDefault) {
    BigDecimal fondo = fondoDefault != null && fondoDefault.compareTo(BigDecimal.ZERO) > 0
        ? fondoDefault
        : FONDO_DEFAULT;
    for (CorteCaja c : corteRepo.findAllByOrderByFechaAsc()) {
      BigDecimal para = montoParaApartar(c, fondo);
      if (c.getParaApartar() != null && c.getParaApartar().compareTo(para) == 0) {
        continue;
      }
      c.setParaApartar(para);
      corteRepo.save(c);
    }
  }

  /**
   * Consulta el periodo cerrado en una fecha de corte (desde el día siguiente al corte
   * anterior hasta ese día inclusive).
   */
  @Transactional(readOnly = true)
  public CortePeriodoDto detalleCorte(LocalDate fechaCorte) {
    if (fechaCorte == null || !corteRepo.existsByFecha(fechaCorte)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No hay corte en esa fecha");
    }
    List<LocalDate> cortes = corteRepo.findAllByOrderByFechaAsc().stream()
        .map(CorteCaja::getFecha)
        .toList();
    LocalDate anterior = null;
    for (LocalDate f : cortes) {
      if (f.equals(fechaCorte)) {
        break;
      }
      anterior = f;
    }
    LocalDate desde = anterior != null ? anterior.plusDays(1) : INICIO_HISTORICO;
    LocalDate hasta = fechaCorte;

    CorteCaja guardado = corteRepo.findByFecha(fechaCorte).orElseThrow();
    BigDecimal fondo = guardado.getFondoPeriodo() != null
        ? nz(guardado.getFondoPeriodo())
        : (anterior == null ? FONDO_HISTORICO : FONDO_DEFAULT);

    Totales t = calcularTotales(desde, hasta, fondo);

    BigDecimal calculadora = guardado.getTotalCalculadora();
    BigDecimal diferencia = null;
    if (calculadora != null) {
      diferencia = calculadora.subtract(t.totalCaja).setScale(2, RoundingMode.HALF_UP);
    } else if (guardado.getTotalCaja() != null && guardado.getTotalCalculadora() != null) {
      diferencia = guardado.getTotalCalculadora().subtract(guardado.getTotalCaja())
          .setScale(2, RoundingMode.HALF_UP);
    }

    // Preferir snapshot guardado si existe (corte marcado en la app)
    BigDecimal totalCaja = guardado.getTotalCaja() != null ? guardado.getTotalCaja() : t.totalCaja;
    BigDecimal totalNegocio =
        guardado.getTotalNegocio() != null ? guardado.getTotalNegocio() : t.totalNegocio;
    if (calculadora != null && guardado.getTotalCaja() != null) {
      diferencia = calculadora.subtract(guardado.getTotalCaja()).setScale(2, RoundingMode.HALF_UP);
    } else if (calculadora != null) {
      diferencia = calculadora.subtract(t.totalCaja).setScale(2, RoundingMode.HALF_UP);
    }

    BigDecimal fondoNuevo = FONDO_DEFAULT;
    CajaConfig cfgActual = configRepo.findById(1L).orElse(null);
    if (cfgActual != null && cfgActual.getFondoInicial() != null
        && cfgActual.getFondoInicial().compareTo(BigDecimal.ZERO) > 0) {
      fondoNuevo = cfgActual.getFondoInicial();
    }
    BigDecimal paraApartar = montoParaApartar(guardado, fondoNuevo);
    if (guardado.getParaApartar() == null || guardado.getParaApartar().compareTo(paraApartar) != 0) {
      // detalleCorte es readOnly; el valor va en el DTO. Persistencia al normalizar/marcar.
    }

    return new CortePeriodoDto(
        fechaCorte,
        desde,
        hasta,
        fondo.setScale(2, RoundingMode.HALF_UP),
        t.productos,
        t.recargas,
        t.servicios,
        t.ingresos,
        t.retiros,
        t.transferencias,
        t.retirosTx,
        t.apartadosProductos,
        t.apartadosServicios,
        totalCaja,
        t.totalTx,
        totalNegocio,
        calculadora,
        diferencia,
        paraApartar,
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
    if (req.fechaFin() != null) {
      if (req.fechaFin().isAfter(LocalDate.now(ZONA))) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha fin no puede ser posterior a hoy");
      }
      cfg.setFechaFin(req.fechaFin());
    }
    if (req.fondoInicial() != null) cfg.setFondoInicial(req.fondoInicial());
    return configRepo.save(cfg);
  }

  /**
   * Registra un corte. Guarda snapshot del periodo cerrado y abre el nuevo con fondo $200.
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

    CajaConfig cfg = getOrCreateConfig();
    LocalDate desde = cfg.getFechaInicio() != null ? cfg.getFechaInicio() : INICIO_HISTORICO;
    LocalDate hasta = corte;
    BigDecimal fondoCierre = req.fondoPeriodo() != null ? nz(req.fondoPeriodo()) : nz(cfg.getFondoInicial());
    Totales t = calcularTotales(desde, hasta, fondoCierre);

    CorteCaja c = corteRepo.findByFecha(corte).orElseGet(CorteCaja::new);
    c.setFecha(corte);
    c.setFondoPeriodo(fondoCierre);
    c.setTotalCaja(t.totalCaja);
    c.setTotalNegocio(t.totalNegocio);
    if (req.totalCalculadora() != null) {
      c.setTotalCalculadora(req.totalCalculadora().setScale(2, RoundingMode.HALF_UP));
    }

    LocalDate inicio = corte.plusDays(1);
    LocalDate hoy = LocalDate.now(ZONA);
    LocalDate fin = hoy.isBefore(inicio) ? inicio : hoy;
    BigDecimal fondo = req.fondoInicial() != null ? req.fondoInicial() : FONDO_DEFAULT;

    // Automático: contado − fondo que queda en caja (default $200).
    BigDecimal cajaTot = nz(t.totalCaja);
    BigDecimal calc =
        c.getTotalCalculadora() != null && c.getTotalCalculadora().compareTo(BigDecimal.ZERO) > 0
            ? c.getTotalCalculadora()
            : BigDecimal.ZERO;
    BigDecimal contado = calc.max(cajaTot);
    c.setParaApartar(contado.subtract(fondo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
    corteRepo.save(c);

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

  private Totales calcularTotales(LocalDate desde, LocalDate hasta, BigDecimal fondo) {
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

    BigDecimal totalCaja = fondo
        .add(productos).add(recargas).add(servicios).add(ingresos)
        .subtract(retiros)
        .subtract(transferencias)
        .subtract(apartadosProductos)
        .subtract(apartadosServicios)
        .setScale(2, RoundingMode.HALF_UP);

    BigDecimal totalTx = transferencias.subtract(retirosTx).setScale(2, RoundingMode.HALF_UP);
    BigDecimal totalNegocio = totalCaja.add(totalTx).setScale(2, RoundingMode.HALF_UP);

    return new Totales(
        fondo.setScale(2, RoundingMode.HALF_UP),
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
        totalNegocio
    );
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

  private record Totales(
      BigDecimal fondo,
      BigDecimal productos,
      BigDecimal recargas,
      BigDecimal servicios,
      BigDecimal retiros,
      BigDecimal ingresos,
      BigDecimal retirosTx,
      BigDecimal transferencias,
      BigDecimal apartadosProductos,
      BigDecimal apartadosServicios,
      BigDecimal totalCaja,
      BigDecimal totalTx,
      BigDecimal totalNegocio
  ) {}
}
