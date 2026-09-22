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
import com.productoslimpieza.repo.TraspasoAbonoRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.tenant.TenantContext;
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
  private static final List<TipoVenta> TIPOS_PRODUCTO =
      List.of(
          TipoVenta.LITROS,
          TipoVenta.PIEZA,
          TipoVenta.PESOS,
          TipoVenta.MAYOREO,
          TipoVenta.CASA,
          TipoVenta.MUESTRA);

  private final CajaConfigRepository configRepo;
  private final MovimientoCajaRepository movimientoRepo;
  private final VentaRepository ventaRepo;
  private final ApartadoRepository apartadoRepo;
  private final CorteCajaRepository corteRepo;
  private final ApartadoRubroService rubroService;
  private final TraspasoAbonoRepository traspasoAbonoRepo;

  public CajaService(
      CajaConfigRepository configRepo,
      MovimientoCajaRepository movimientoRepo,
      VentaRepository ventaRepo,
      ApartadoRepository apartadoRepo,
      CorteCajaRepository corteRepo,
      ApartadoRubroService rubroService,
      TraspasoAbonoRepository traspasoAbonoRepo) {
    this.configRepo = configRepo;
    this.movimientoRepo = movimientoRepo;
    this.ventaRepo = ventaRepo;
    this.apartadoRepo = apartadoRepo;
    this.corteRepo = corteRepo;
    this.rubroService = rubroService;
    this.traspasoAbonoRepo = traspasoAbonoRepo;
  }

  @Transactional
  public CajaResumenDto resumen() {
    CajaConfig cfg = getOrCreateConfig();
    asegurarCorteInicialSiNoHay(cfg);
    LocalDate desde = cfg.getFechaInicio() != null ? cfg.getFechaInicio() : LocalDate.of(2000, 1, 1);
    LocalDate hasta = finPeriodoAbierto(cfg);
    // Tras un corte el fondo ya es el efectivo que quedó en cajón; los ingresos a
    // apartados que liquidan el "para apartar" del corte no deben volver a restar.
    BigDecimal exentoApartados = montoParaApartarUltimoCorte(nz(cfg.getFondoInicial()));
    Totales t = calcularTotales(desde, hasta, nz(cfg.getFondoInicial()), exentoApartados);

    List<LocalDate> fechasCorte = corteRepo.findAllByOrderByFechaAsc().stream()
        .map(CorteCaja::getFecha)
        .toList();
    LocalDate ultimoCorte = corteRepo.findMaxFecha(TenantContext.require()).orElseGet(() ->
        cfg.getFechaInicio() != null ? cfg.getFechaInicio().minusDays(1) : null);

    BigDecimal fondoCfg = nz(cfg.getFondoInicial());
    BigDecimal paraApartarCorte = montoParaApartarUltimoCorte(fondoCfg);
    List<String> catsApartar = rubroService.codigosLiquidaCorte();
    // Incluye el día del corte: suele apartarse el mismo día; fechaInicio es corte+1.
    LocalDate desdeYaApartado = ultimoCorte != null ? ultimoCorte : desde;
    BigDecimal yaApartado = ultimoCorte != null
        ? nz(apartadoRepo.sumIngresosByCategoriasAndFecha(catsApartar, desdeYaApartado, hasta))
        : BigDecimal.ZERO;
    BigDecimal disponibleApartar = paraApartarCorte
        .subtract(yaApartado)
        .max(BigDecimal.ZERO)
        .setScale(2, RoundingMode.HALF_UP);
    // Sin cortes: disponible = exceso de caja sobre el fondo (periodo abierto histórico).
    if (ultimoCorte == null) {
      disponibleApartar = t.totalCaja.subtract(fondoCfg.max(FONDO_DEFAULT))
          .max(BigDecimal.ZERO)
          .setScale(2, RoundingMode.HALF_UP);
      paraApartarCorte = disponibleApartar;
      yaApartado = BigDecimal.ZERO;
    }

    BigDecimal ventasTarjetaGlobal = nz(ventaRepo.sumTotalTarjetaByTipos(TIPOS_PRODUCTO))
        .add(nz(traspasoAbonoRepo.sumMontoPagoTarjeta()))
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal saldoBancoGlobal = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.TRANSFERENCIA))
        .subtract(nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO_TRANSFERENCIA)))
        .add(ventasTarjetaGlobal)
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal transferenciasGlobal = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.TRANSFERENCIA))
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal retirosTxGlobal = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO_TRANSFERENCIA))
        .setScale(2, RoundingMode.HALF_UP);
    // Negocio = efectivo del periodo + saldo de banco (global, no del periodo).
    BigDecimal totalNegocio = t.totalCaja.add(saldoBancoGlobal).setScale(2, RoundingMode.HALF_UP);

    return new CajaResumenDto(
        cfg.getFechaInicio(),
        hasta,
        t.fondo,
        t.productos,
        t.recargas,
        t.servicios,
        t.retiros,
        t.ingresos,
        retirosTxGlobal,
        transferenciasGlobal,
        t.apartadosProductos,
        t.apartadosServicios,
        t.totalCaja,
        saldoBancoGlobal,
        totalNegocio,
        fechasCorte,
        ultimoCorte,
        paraApartarCorte.setScale(2, RoundingMode.HALF_UP),
        yaApartado.setScale(2, RoundingMode.HALF_UP),
        disponibleApartar,
        mapMovs(TipoMovimientoCaja.RETIRO, desde, hasta),
        mapMovs(TipoMovimientoCaja.INGRESO, desde, hasta),
        mapMovsTodos(TipoMovimientoCaja.RETIRO_TRANSFERENCIA),
        mapMovsTodos(TipoMovimientoCaja.TRANSFERENCIA),
        ventasTarjetaGlobal
    );
  }

  /**
   * Tras un corte: lo apartable = (contado − fondo) − ya apartado desde el día del corte
   * (inclusive). Las ventas del periodo nuevo no aumentan el disponible hasta el siguiente corte.
   */
  private BigDecimal calcularDisponibleParaApartar(
      CajaConfig cfg, Totales tPeriodo, LocalDate desdePeriodo, LocalDate hastaPeriodo) {
    BigDecimal fondo = nz(cfg.getFondoInicial());
    if (fondo.compareTo(BigDecimal.ZERO) <= 0) {
      fondo = FONDO_DEFAULT;
    }
    var ultimoOpt = corteRepo.findMaxFecha(TenantContext.require()).flatMap(corteRepo::findByFecha);
    if (ultimoOpt.isEmpty()) {
      return tPeriodo.totalCaja.subtract(fondo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
    CorteCaja ultimo = ultimoOpt.get();
    BigDecimal aApartarDelCorte = montoParaApartar(ultimo, fondo);
    List<String> cats = rubroService.codigosLiquidaCorte();
    LocalDate desdeYa = ultimo.getFecha() != null ? ultimo.getFecha() : desdePeriodo;
    BigDecimal apartadosNuevos = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        cats, desdeYa, hastaPeriodo));
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

  /** Sobrante del último corte (contado − fondo) que se liquida con ingresos a apartados. */
  private BigDecimal montoParaApartarUltimoCorte(BigDecimal fondoQueQueda) {
    return corteRepo.findMaxFecha(TenantContext.require())
        .flatMap(corteRepo::findByFecha)
        .map(c -> {
          if (c.getParaApartar() != null && c.getParaApartar().compareTo(BigDecimal.ZERO) >= 0) {
            return c.getParaApartar().setScale(2, RoundingMode.HALF_UP);
          }
          BigDecimal fondo = fondoQueQueda.compareTo(BigDecimal.ZERO) > 0 ? fondoQueQueda : FONDO_DEFAULT;
          return montoParaApartar(c, fondo);
        })
        .orElse(BigDecimal.ZERO);
  }

  /**
   * Al cerrar un periodo en {@code fechaCorte}, el sobrante del corte anterior (si hubo)
   * ya quedó fuera del cajón vía el fondo; no debe restar otra vez.
   */
  private BigDecimal exentoApartadosDesdeCorteAnterior(LocalDate fechaCorte) {
    List<LocalDate> cortes = corteRepo.findAllByOrderByFechaAsc().stream()
        .map(CorteCaja::getFecha)
        .toList();
    LocalDate anterior = null;
    for (LocalDate f : cortes) {
      if (fechaCorte != null && !f.isBefore(fechaCorte)) {
        break;
      }
      anterior = f;
    }
    if (anterior == null) {
      return BigDecimal.ZERO;
    }
    CorteCaja prev = corteRepo.findByFecha(anterior).orElse(null);
    if (prev == null) {
      return BigDecimal.ZERO;
    }
    if (prev.getParaApartar() != null && prev.getParaApartar().compareTo(BigDecimal.ZERO) >= 0) {
      return prev.getParaApartar().setScale(2, RoundingMode.HALF_UP);
    }
    return montoParaApartar(prev, FONDO_DEFAULT);
  }

  private BigDecimal contadoDelCorte(CorteCaja corte) {
    BigDecimal caja = nz(corte.getTotalCaja());
    BigDecimal calc =
        corte.getTotalCalculadora() != null
                && corte.getTotalCalculadora().compareTo(BigDecimal.ZERO) > 0
            ? corte.getTotalCalculadora()
            : BigDecimal.ZERO;
    // Si hubo contado, ese es el efectivo real (faltante/sobrante); si no, el teórico.
    return calc.compareTo(BigDecimal.ZERO) > 0 ? calc : caja;
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

    // En un periodo cerrado, los apartados del propio periodo sí salieron del cajón.
    Totales t = calcularTotales(desde, hasta, fondo, BigDecimal.ZERO);

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
    BigDecimal totalIngresos =
        guardado.getTotalIngresos() != null ? guardado.getTotalIngresos() : t.ingresos;
    BigDecimal totalRetiros =
        guardado.getTotalRetiros() != null ? guardado.getTotalRetiros() : t.retiros;
    if (calculadora != null && guardado.getTotalCaja() != null) {
      diferencia = calculadora.subtract(guardado.getTotalCaja()).setScale(2, RoundingMode.HALF_UP);
    } else if (calculadora != null) {
      diferencia = calculadora.subtract(t.totalCaja).setScale(2, RoundingMode.HALF_UP);
    }

    BigDecimal fondoNuevo = FONDO_DEFAULT;
    CajaConfig cfgActual = configRepo.findByTenantId(TenantContext.require()).orElse(null);
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
        totalIngresos,
        totalRetiros,
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
   * Registra un corte. Guarda snapshot del periodo cerrado (incl. ingresos/retiros)
   * y abre el nuevo con el fondo indicado; el periodo abierto arranca ingresos/retiros en 0.
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
    LocalDate desde = inicioPeriodoParaCorte(corte);
    LocalDate hasta = corte;
    BigDecimal fondoCierre = req.fondoPeriodo() != null ? nz(req.fondoPeriodo()) : nz(cfg.getFondoInicial());
    Totales t = calcularTotales(desde, hasta, fondoCierre, exentoApartadosDesdeCorteAnterior(corte));

    CorteCaja c = corteRepo.findByFecha(corte).orElseGet(CorteCaja::new);
    c.setFecha(corte);
    c.setFondoPeriodo(fondoCierre);
    aplicarSnapshotTotales(c, t);
    if (req.totalCalculadora() != null) {
      c.setTotalCalculadora(req.totalCalculadora().setScale(2, RoundingMode.HALF_UP));
    }

    LocalDate inicio = corte.plusDays(1);
    LocalDate hoy = LocalDate.now(ZONA);
    LocalDate fin = hoy.isBefore(inicio) ? inicio : hoy;
    BigDecimal fondo = req.fondoInicial() != null ? req.fondoInicial() : FONDO_DEFAULT;

    // Automático: contado real − fondo que queda en caja (default $200).
    // Con faltante manda la calculadora; sin contado, el total teórico.
    BigDecimal cajaTot = nz(t.totalCaja);
    BigDecimal calc =
        c.getTotalCalculadora() != null && c.getTotalCalculadora().compareTo(BigDecimal.ZERO) > 0
            ? c.getTotalCalculadora()
            : BigDecimal.ZERO;
    BigDecimal contado = calc.compareTo(BigDecimal.ZERO) > 0 ? calc : cajaTot;
    c.setParaApartar(contado.subtract(fondo).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
    corteRepo.save(c);

    cfg.setFechaInicio(inicio);
    cfg.setFechaFin(fin);
    cfg.setFondoInicial(fondo);
    return configRepo.save(cfg);
  }

  @Transactional
  public MovimientoCajaDto crearMovimiento(MovimientoCajaRequest req) {
    if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto debe ser mayor a 0");
    }
    if (req.fecha() != null && req.fecha().isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser posterior a hoy");
    }
    CajaConfig cfg = getOrCreateConfig();
    LocalDate fecha = req.fecha();
    boolean enPeriodoCerrado = fechaEnPeriodoCerrado(cfg, fecha);
    if (!enPeriodoCerrado) {
      validarFechaEnPeriodoAbierto(cfg, fecha);
      ampliarFechaFinSiHaceFalta(cfg, fecha);
    }

    // Banco: saldo global (todas las fechas). No se filtra por periodo/corte.
    if (req.tipo() == TipoMovimientoCaja.RETIRO_TRANSFERENCIA) {
      BigDecimal saldoBanco = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.TRANSFERENCIA))
          .subtract(nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO_TRANSFERENCIA)));
      if (req.monto().compareTo(saldoBanco) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Saldo en banco insuficiente ($" + saldoBanco.setScale(2, RoundingMode.HALF_UP) + ")");
      }
    }

    MovimientoCaja m = new MovimientoCaja();
    m.setFecha(fecha);
    m.setTipo(req.tipo());
    m.setMonto(req.monto());
    m.setMotivo(req.motivo());
    MovimientoCajaDto dto = toDto(movimientoRepo.save(m));
    if (enPeriodoCerrado) {
      resnapshotCorteQueContiene(fecha);
    }
    return dto;
  }

  @Transactional
  public MovimientoCajaDto actualizarMovimiento(Long id, MovimientoCajaRequest req) {
    MovimientoCaja m = movimientoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimiento no encontrado"));
    if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto debe ser mayor a 0");
    }
    if (req.fecha() != null && req.fecha().isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha no puede ser posterior a hoy");
    }
    CajaConfig cfg = getOrCreateConfig();
    LocalDate fechaAnterior = m.getFecha();
    LocalDate fecha = req.fecha() != null ? req.fecha() : fechaAnterior;
    boolean enPeriodoCerrado = fechaEnPeriodoCerrado(cfg, fecha);
    if (!enPeriodoCerrado) {
      validarFechaEnPeriodoAbierto(cfg, fecha);
    }
    if (req.tipo() == TipoMovimientoCaja.RETIRO_TRANSFERENCIA) {
      BigDecimal saldoBanco = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.TRANSFERENCIA))
          .subtract(nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO_TRANSFERENCIA)));
      if (m.getTipo() == TipoMovimientoCaja.RETIRO_TRANSFERENCIA) {
        saldoBanco = saldoBanco.add(nz(m.getMonto()));
      }
      if (req.monto().compareTo(saldoBanco) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Saldo en banco insuficiente ($" + saldoBanco.setScale(2, RoundingMode.HALF_UP) + ")");
      }
    }
    m.setFecha(fecha);
    m.setTipo(req.tipo() != null ? req.tipo() : m.getTipo());
    m.setMonto(req.monto());
    m.setMotivo(req.motivo());
    MovimientoCajaDto dto = toDto(movimientoRepo.save(m));
    if (fechaEnPeriodoCerrado(cfg, fechaAnterior)) {
      resnapshotCorteQueContiene(fechaAnterior);
    }
    if (enPeriodoCerrado) {
      resnapshotCorteQueContiene(fecha);
    }
    return dto;
  }

  @Transactional
  public void eliminarMovimiento(Long id) {
    MovimientoCaja m = movimientoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimiento no encontrado"));
    LocalDate fecha = m.getFecha();
    CajaConfig cfg = getOrCreateConfig();
    boolean cerrado = fechaEnPeriodoCerrado(cfg, fecha);
    movimientoRepo.delete(m);
    if (cerrado) {
      resnapshotCorteQueContiene(fecha);
    }
  }

  private Totales calcularTotales(
      LocalDate desde, LocalDate hasta, BigDecimal fondo, BigDecimal apartadosExentosDelCorte) {
    BigDecimal productosAll = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, TIPOS_PRODUCTO));
    BigDecimal productosTarjeta =
        nz(ventaRepo.sumTotalByFechaAndTiposAndPagoTarjeta(desde, hasta, TIPOS_PRODUCTO, true));
    BigDecimal productosEfectivo = productosAll.subtract(productosTarjeta).max(BigDecimal.ZERO);
    BigDecimal recargas = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.RECARGA)));
    BigDecimal servicios = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.PAGO_DE_SERVICIOS)));

    BigDecimal retiros = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.RETIRO, desde, hasta));
    BigDecimal ingresos = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.INGRESO, desde, hasta));
    BigDecimal retirosTx = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.RETIRO_TRANSFERENCIA, desde, hasta));
    BigDecimal transferencias = nz(movimientoRepo.sumByTipoAndFecha(TipoMovimientoCaja.TRANSFERENCIA, desde, hasta));

    BigDecimal apartadosProductosBruto = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        rubroService.codigosLiquidaCorte(), desde, hasta));
    BigDecimal apartadosServiciosBruto = nz(apartadoRepo.sumIngresosByCategoriasAndFecha(
        List.of(CategoriaApartado.SERVICIOS.name()), desde, hasta));

    BigDecimal exento = nz(apartadosExentosDelCorte).max(BigDecimal.ZERO);
    // Primero se liquida el sobrante del corte (productos/casa/salarios); el resto sí sale del cajón.
    BigDecimal exentoProd = apartadosProductosBruto.min(exento);
    BigDecimal restoExento = exento.subtract(exentoProd);
    BigDecimal exentoServ = apartadosServiciosBruto.min(restoExento);
    BigDecimal apartadosProductos = apartadosProductosBruto.subtract(exentoProd).max(BigDecimal.ZERO);
    BigDecimal apartadosServicios = apartadosServiciosBruto.subtract(exentoServ).max(BigDecimal.ZERO);

    BigDecimal totalCaja = fondo
        .add(productosEfectivo).add(recargas).add(servicios).add(ingresos)
        .add(retirosTx) // retiro del banco → entra efectivo a la caja del periodo
        .subtract(retiros)
        .subtract(transferencias) // transferencia a banco → sale de caja
        .subtract(apartadosProductos)
        .subtract(apartadosServicios)
        .setScale(2, RoundingMode.HALF_UP);

    // Neto banco del periodo (solo para snapshots de corte); el saldo global se calcula aparte.
    BigDecimal totalTx = transferencias.subtract(retirosTx).setScale(2, RoundingMode.HALF_UP);
    BigDecimal totalNegocio = totalCaja.add(totalTx).setScale(2, RoundingMode.HALF_UP);

    return new Totales(
        fondo.setScale(2, RoundingMode.HALF_UP),
        productosAll.setScale(2, RoundingMode.HALF_UP),
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

  private List<MovimientoCajaDto> mapMovsTodos(TipoMovimientoCaja tipo) {
    return movimientoRepo.findByTipoOrderByFechaDescIdDesc(tipo).stream().map(this::toDto).toList();
  }

  private MovimientoCajaDto toDto(MovimientoCaja m) {
    return new MovimientoCajaDto(m.getId(), m.getFecha(), m.getTipo(), m.getMonto(), m.getMotivo());
  }

  private CajaConfig getOrCreateConfig() {
    return configRepo.findByTenantId(TenantContext.require()).orElseGet(() -> {
      CajaConfig c = new CajaConfig();
      c.setId(configRepo.nextId());
      c.setTenantId(TenantContext.require());
      c.setFondoInicial(FONDO_DEFAULT);
      return configRepo.save(c);
    });
  }

  /**
   * Mama (Excel): si faltan cortes históricos, los crea y alinea el periodo al último
   * (igual que admin con su historial de chips).
   * Otros tenants: solo corte semilla del día previo al inicio si no hay ninguno.
   */
  private void asegurarCorteInicialSiNoHay(CajaConfig cfg) {
    if ("mama".equals(TenantContext.get())) {
      asegurarCortesMamaDesdeExcel(cfg);
      return;
    }
    if (cfg.getFechaInicio() == null) return;
    if (corteRepo.findMaxFecha(TenantContext.require()).isPresent()) return;
    LocalDate fechaCorte = cfg.getFechaInicio().minusDays(1);
    if (corteRepo.findByFecha(fechaCorte).isPresent()) return;
    CorteCaja c = new CorteCaja();
    c.setTenantId(TenantContext.require());
    c.setFecha(fechaCorte);
    c.setFondoPeriodo(nz(cfg.getFondoInicial()));
    c.setTotalCaja(BigDecimal.ZERO);
    c.setTotalNegocio(BigDecimal.ZERO);
    c.setTotalCalculadora(BigDecimal.ZERO);
    c.setParaApartar(BigDecimal.ZERO);
    corteRepo.save(c);
  }

  /**
   * Cortes históricos Mama (Excel). El 13/09 es de admin, no de mamá.
   * Tras el 22/08 el periodo abierto arranca con fondo propio ($50), no el $200 de admin.
   */
  private static final BigDecimal FONDO_MAMA_PERIODO_ABIERTO = new BigDecimal("50.00");
  private static final List<CorteSemilla> CORTES_MAMA = List.of(
      new CorteSemilla(LocalDate.of(2026, 4, 14), bd("0"), bd("0")),
      new CorteSemilla(LocalDate.of(2026, 4, 19), bd("102"), bd("0")),
      new CorteSemilla(LocalDate.of(2026, 4, 26), bd("361"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 5, 3), bd("108"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 5, 19), bd("384.5"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 6, 9), bd("580"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 7, 4), bd("645.5"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 7, 21), bd("500"), bd("200")),
      new CorteSemilla(LocalDate.of(2026, 8, 22), bd("980"), bd("200"))
  );

  private void asegurarCortesMamaDesdeExcel(CajaConfig cfg) {
    String tenant = TenantContext.require();
    // El apartado del 25/08 no es corte; el corte de ese periodo fue el 22/08.
    corteRepo.findByFecha(LocalDate.of(2026, 8, 25)).ifPresent(erroneo -> {
      if (corteRepo.findByFecha(LocalDate.of(2026, 8, 22)).isEmpty()) {
        erroneo.setFecha(LocalDate.of(2026, 8, 22));
        corteRepo.saveAndFlush(erroneo);
      } else {
        corteRepo.delete(erroneo);
        corteRepo.flush();
      }
    });
    // El 13/09 es de admin; cualquier copia en mamá (semilla o bleed) se elimina.
    corteRepo.findByFecha(LocalDate.of(2026, 9, 13)).ifPresent(erroneo -> {
      corteRepo.delete(erroneo);
      corteRepo.flush();
    });
    for (CorteSemilla s : CORTES_MAMA) {
      if (corteRepo.findByFecha(s.fecha()).isPresent()) continue;
      try {
        CorteCaja c = new CorteCaja();
        c.setTenantId(tenant);
        c.setFecha(s.fecha());
        c.setFondoPeriodo(s.fondoPeriodo());
        c.setParaApartar(s.paraApartar());
        BigDecimal fondoCierre =
            s.fondoPeriodo().compareTo(BigDecimal.ZERO) > 0 ? s.fondoPeriodo() : FONDO_DEFAULT;
        c.setTotalCaja(s.paraApartar().add(fondoCierre).setScale(2, RoundingMode.HALF_UP));
        c.setTotalCalculadora(c.getTotalCaja());
        c.setTotalNegocio(c.getTotalCaja());
        corteRepo.saveAndFlush(c);
      } catch (Exception e) {
        // carrera / unique: ya existe para este tenant
      }
    }
    LocalDate ultimoSemilla = CORTES_MAMA.get(CORTES_MAMA.size() - 1).fecha();
    LocalDate ultimo = corteRepo.findMaxFecha(TenantContext.require()).orElse(ultimoSemilla);
    // Si solo hay historial Excel, el abierto empieza el 23/08; un corte real posterior sí manda.
    if (ultimo.isBefore(ultimoSemilla)) {
      ultimo = ultimoSemilla;
    }
    LocalDate inicioEsperado = ultimo.plusDays(1);
    LocalDate hoy = LocalDate.now(ZONA);
    boolean cfgDirty = false;
    if (cfg.getFechaInicio() == null || !cfg.getFechaInicio().equals(inicioEsperado)) {
      cfg.setFechaInicio(inicioEsperado);
      cfgDirty = true;
    }
    // Fondo del periodo abierto: propio de mamá ($50 tras el Excel), no el default de admin.
    if (ultimo.equals(ultimoSemilla)) {
      BigDecimal fondo = cfg.getFondoInicial();
      if (fondo == null
          || fondo.compareTo(BigDecimal.ZERO) == 0
          || fondo.compareTo(FONDO_DEFAULT) == 0) {
        cfg.setFondoInicial(FONDO_MAMA_PERIODO_ABIERTO);
        cfgDirty = true;
      }
    } else if (cfg.getFondoInicial() == null || cfg.getFondoInicial().compareTo(BigDecimal.ZERO) == 0) {
      cfg.setFondoInicial(FONDO_MAMA_PERIODO_ABIERTO);
      cfgDirty = true;
    }
    LocalDate fin = hoy.isBefore(inicioEsperado) ? inicioEsperado : hoy;
    if (cfg.getFechaFin() == null || cfg.getFechaFin().isBefore(inicioEsperado)) {
      cfg.setFechaFin(fin);
      cfgDirty = true;
    }
    if (cfgDirty) {
      configRepo.save(cfg);
    }
  }

  private static BigDecimal bd(String s) {
    return new BigDecimal(s);
  }

  private record CorteSemilla(LocalDate fecha, BigDecimal paraApartar, BigDecimal fondoPeriodo) {}

  /**
   * Fin del periodo abierto: al menos hasta hoy, para que retiros/transferencias
   * del día se vean aunque la fecha fin del corte planeado se haya quedado atrás.
   */
  /** True si la fecha cae en el periodo abierto o en un corte ya cerrado. */
  @Transactional(readOnly = true)
  public boolean aceptaFechaMovimiento(LocalDate fecha) {
    if (fecha == null || fecha.isAfter(LocalDate.now(ZONA))) {
      return false;
    }
    CajaConfig cfg = configRepo.findByTenantId(TenantContext.require()).orElse(null);
    if (cfg == null) {
      return true;
    }
    LocalDate inicioAbierto = cfg.getFechaInicio();
    if (inicioAbierto == null || !fecha.isBefore(inicioAbierto)) {
      return true;
    }
    return encontrarCorteQueContiene(fecha) != null;
  }

  private LocalDate finPeriodoAbierto(CajaConfig cfg) {
    LocalDate hoy = LocalDate.now(ZONA);
    LocalDate fin = cfg.getFechaFin();
    if (fin == null || fin.isBefore(hoy)) {
      return hoy;
    }
    return fin;
  }

  /** Inicio del periodo que cierra en {@code fechaCorte}: día siguiente al corte anterior. */
  private LocalDate inicioPeriodoParaCorte(LocalDate fechaCorte) {
    LocalDate anterior = null;
    for (CorteCaja c : corteRepo.findAllByOrderByFechaAsc()) {
      if (c.getFecha() == null) continue;
      if (c.getFecha().equals(fechaCorte) || c.getFecha().isAfter(fechaCorte)) {
        break;
      }
      anterior = c.getFecha();
    }
    if (anterior != null) {
      return anterior.plusDays(1);
    }
    CajaConfig cfg = configRepo.findByTenantId(TenantContext.require()).orElse(null);
    if (cfg != null && cfg.getFechaInicio() != null && !cfg.getFechaInicio().isAfter(fechaCorte)) {
      return cfg.getFechaInicio();
    }
    return INICIO_HISTORICO;
  }

  private void aplicarSnapshotTotales(CorteCaja c, Totales t) {
    c.setTotalCaja(t.totalCaja);
    c.setTotalNegocio(t.totalNegocio);
    c.setTotalIngresos(t.ingresos);
    c.setTotalRetiros(t.retiros);
  }

  private void validarFechaEnPeriodoAbierto(CajaConfig cfg, LocalDate fecha) {
    LocalDate desde = cfg.getFechaInicio();
    if (desde != null && fecha != null && fecha.isBefore(desde)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "La fecha es anterior al inicio del periodo (" + desde
              + "). Si el movimiento es de un corte ya cerrado, usa la fecha de ese periodo.");
    }
  }

  private void ampliarFechaFinSiHaceFalta(CajaConfig cfg, LocalDate fecha) {
    LocalDate hoy = LocalDate.now(ZONA);
    LocalDate fin = cfg.getFechaFin();
    LocalDate necesario = fecha != null && fecha.isAfter(hoy) ? hoy : (fecha != null ? fecha : hoy);
    if (necesario.isBefore(hoy)) {
      necesario = hoy;
    }
    if (fin == null || fin.isBefore(necesario)) {
      cfg.setFechaFin(necesario);
      configRepo.save(cfg);
    }
  }

  /**
   * Fecha anterior al periodo abierto pero dentro de algún corte ya guardado
   * (p. ej. abono de traspaso que olvidaron registrar antes del corte).
   */
  private boolean fechaEnPeriodoCerrado(CajaConfig cfg, LocalDate fecha) {
    if (fecha == null) return false;
    LocalDate inicioAbierto = cfg.getFechaInicio();
    if (inicioAbierto == null || !fecha.isBefore(inicioAbierto)) {
      return false;
    }
    return encontrarCorteQueContiene(fecha) != null;
  }

  private CorteCaja encontrarCorteQueContiene(LocalDate fecha) {
    if (fecha == null) return null;
    List<CorteCaja> cortes = corteRepo.findAllByOrderByFechaAsc();
    LocalDate anterior = null;
    for (CorteCaja c : cortes) {
      if (c.getFecha() == null) continue;
      LocalDate desde = anterior != null ? anterior.plusDays(1) : INICIO_HISTORICO;
      LocalDate hasta = c.getFecha();
      if (!fecha.isBefore(desde) && !fecha.isAfter(hasta)) {
        return c;
      }
      anterior = c.getFecha();
    }
    return null;
  }

  /** Recalcula totales teóricos del corte (no toca calculadora ni paraApartar). */
  private void resnapshotCorteQueContiene(LocalDate fecha) {
    CorteCaja c = encontrarCorteQueContiene(fecha);
    if (c == null || c.getFecha() == null) return;
    LocalDate hasta = c.getFecha();
    LocalDate desde = inicioPeriodoParaCorte(hasta);
    BigDecimal fondo = c.getFondoPeriodo() != null ? nz(c.getFondoPeriodo()) : FONDO_DEFAULT;
    Totales t = calcularTotales(desde, hasta, fondo, BigDecimal.ZERO);
    aplicarSnapshotTotales(c, t);
    corteRepo.save(c);
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
