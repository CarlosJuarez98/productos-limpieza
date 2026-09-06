package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.MovimientoCaja;
import com.productoslimpieza.domain.TipoMovimientoCaja;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.MovimientoCajaRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.CajaConfigRequest;
import com.productoslimpieza.web.dto.CajaResumenDto;
import com.productoslimpieza.web.dto.MovimientoCajaDto;
import com.productoslimpieza.web.dto.MovimientoCajaRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CajaService {

  private final CajaConfigRepository configRepo;
  private final MovimientoCajaRepository movimientoRepo;
  private final VentaRepository ventaRepo;

  public CajaService(
      CajaConfigRepository configRepo,
      MovimientoCajaRepository movimientoRepo,
      VentaRepository ventaRepo) {
    this.configRepo = configRepo;
    this.movimientoRepo = movimientoRepo;
    this.ventaRepo = ventaRepo;
  }

  @Transactional(readOnly = true)
  public CajaResumenDto resumen() {
    CajaConfig cfg = getOrCreateConfig();
    LocalDate desde = cfg.getFechaInicio() != null ? cfg.getFechaInicio() : LocalDate.of(2000, 1, 1);
    LocalDate hasta = cfg.getFechaFin() != null ? cfg.getFechaFin() : LocalDate.now();

    BigDecimal productos = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta,
        List.of(TipoVenta.LITROS, TipoVenta.PIEZA, TipoVenta.PESOS)));
    BigDecimal recargas = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.RECARGA)));
    BigDecimal servicios = nz(ventaRepo.sumTotalByFechaAndTipos(desde, hasta, List.of(TipoVenta.PAGO_DE_SERVICIOS)));

    BigDecimal retiros = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO));
    BigDecimal ingresos = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.INGRESO));
    BigDecimal retirosTx = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.RETIRO_TRANSFERENCIA));
    BigDecimal transferencias = nz(movimientoRepo.sumByTipo(TipoMovimientoCaja.TRANSFERENCIA));

    BigDecimal fondo = nz(cfg.getFondoInicial());
    BigDecimal totalCaja = fondo
        .add(productos).add(recargas).add(servicios).add(ingresos)
        .subtract(retiros).subtract(retirosTx)
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal totalTx = transferencias.subtract(retirosTx).setScale(2, RoundingMode.HALF_UP);
    BigDecimal totalNegocio = totalCaja.add(totalTx).setScale(2, RoundingMode.HALF_UP);

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
        totalCaja,
        totalTx,
        totalNegocio,
        mapMovs(TipoMovimientoCaja.RETIRO),
        mapMovs(TipoMovimientoCaja.INGRESO),
        mapMovs(TipoMovimientoCaja.RETIRO_TRANSFERENCIA),
        mapMovs(TipoMovimientoCaja.TRANSFERENCIA)
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

  private List<MovimientoCajaDto> mapMovs(TipoMovimientoCaja tipo) {
    return movimientoRepo.findByTipoOrderByFechaDescIdDesc(tipo).stream().map(this::toDto).toList();
  }

  private MovimientoCajaDto toDto(MovimientoCaja m) {
    return new MovimientoCajaDto(m.getId(), m.getFecha(), m.getTipo(), m.getMonto(), m.getMotivo());
  }

  private CajaConfig getOrCreateConfig() {
    return configRepo.findById(1L).orElseGet(() -> {
      CajaConfig c = new CajaConfig();
      c.setId(1L);
      c.setFondoInicial(BigDecimal.ZERO);
      return configRepo.save(c);
    });
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
