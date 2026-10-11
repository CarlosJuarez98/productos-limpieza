package com.productoslimpieza.service;

import com.productoslimpieza.domain.PedidoAbono;
import com.productoslimpieza.domain.PrestamoAdmin;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import com.productoslimpieza.domain.TipoPrestamoAdmin;
import com.productoslimpieza.repo.PedidoAbonoRepository;
import com.productoslimpieza.repo.PrestamoAdminRepository;
import com.productoslimpieza.web.dto.ApartadoDto;
import com.productoslimpieza.web.dto.ApartadoRequest;
import com.productoslimpieza.web.dto.PrestamoAdminDto;
import com.productoslimpieza.web.dto.PrestamoAdminRequest;
import com.productoslimpieza.web.dto.PrestamoAdminResumenDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PrestamoAdminService {

  private final PrestamoAdminRepository repo;
  private final PedidoAbonoRepository abonoRepo;
  private final ApartadoService apartadoService;

  public PrestamoAdminService(
      PrestamoAdminRepository repo,
      PedidoAbonoRepository abonoRepo,
      ApartadoService apartadoService) {
    this.repo = repo;
    this.abonoRepo = abonoRepo;
    this.apartadoService = apartadoService;
  }

  @Transactional
  public PrestamoAdminResumenDto resumen() {
    sincronizarAbonosSinPrestamo();
    BigDecimal prestamos = nz(repo.sumByTipo(TipoPrestamoAdmin.PRESTAMO)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal devoluciones = nz(repo.sumByTipo(TipoPrestamoAdmin.DEVOLUCION)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal saldo = prestamos.subtract(devoluciones).setScale(2, RoundingMode.HALF_UP);
    if (saldo.compareTo(BigDecimal.ZERO) < 0) {
      saldo = BigDecimal.ZERO;
    }
    List<PrestamoAdminDto> movs = repo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList();
    return new PrestamoAdminResumenDto(saldo, prestamos, devoluciones, movs);
  }

  /**
   * Si hubo pagos «con mi dinero» antes de crear/ligar el préstamo, los recupera.
   */
  private void sincronizarAbonosSinPrestamo() {
    for (PedidoAbono a : abonoRepo.findByConDineroPropioTrue()) {
      if (a.getId() == null) continue;
      if (repo.findByPedidoAbonoId(a.getId()).isPresent()) continue;
      Long pedidoId = a.getPedido() != null ? a.getPedido().getId() : null;
      registrarPrestamoPorAbono(
          pedidoId,
          a.getId(),
          a.getFecha(),
          nz(a.getMonto()),
          a.getNota());
    }
  }

  @Transactional
  public PrestamoAdminResumenDto registrar(PrestamoAdminRequest req) {
    TipoPrestamoAdmin tipo;
    try {
      tipo = TipoPrestamoAdmin.valueOf(req.tipo().trim().toUpperCase());
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo inválido (PRESTAMO o DEVOLUCION)");
    }
    BigDecimal monto = req.monto().setScale(2, RoundingMode.HALF_UP);
    PrestamoAdmin p = new PrestamoAdmin();
    p.setFecha(req.fecha());
    p.setMonto(monto);
    p.setTipo(tipo);
    if (req.nota() != null && !req.nota().isBlank()) {
      p.setNota(req.nota().trim());
    }

    if (tipo == TipoPrestamoAdmin.DEVOLUCION) {
      sincronizarAbonosSinPrestamo();
      BigDecimal prestamos = nz(repo.sumByTipo(TipoPrestamoAdmin.PRESTAMO));
      BigDecimal devoluciones = nz(repo.sumByTipo(TipoPrestamoAdmin.DEVOLUCION));
      BigDecimal saldoDeuda = prestamos.subtract(devoluciones).setScale(2, RoundingMode.HALF_UP);
      if (saldoDeuda.compareTo(BigDecimal.ZERO) < 0) {
        saldoDeuda = BigDecimal.ZERO;
      }
      if (monto.compareTo(saldoDeuda.add(new BigDecimal("0.01"))) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Solo te deben $" + saldoDeuda.toPlainString());
      }
      String cat = req.categoria() != null ? req.categoria().trim() : "";
      if (cat.isEmpty()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Elige de qué apartado te paga el negocio (Productos, Salarios, …)");
      }
      BigDecimal saldoApartado = apartadoService.saldoCategoria(cat);
      if (monto.compareTo(saldoApartado.add(new BigDecimal("0.01"))) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "En "
                + cat
                + " no hay suficiente ($"
                + saldoApartado.setScale(2, RoundingMode.HALF_UP).toPlainString()
                + ")");
      }
      String motivo =
          p.getNota() != null
              ? p.getNota()
              : "Devolución al admin (préstamo)";
      ApartadoDto gasto =
          apartadoService.crear(
              new ApartadoRequest(
                  req.fecha(),
                  cat,
                  monto,
                  TipoMovimientoApartado.GASTO,
                  motivo));
      p.setCategoria(gasto.categoria() != null ? gasto.categoria() : cat);
      p.setApartadoId(gasto.id());
      if (p.getNota() == null) {
        p.setNota(motivo);
      }
    } else {
      if (req.categoria() != null && !req.categoria().isBlank()) {
        p.setCategoria(req.categoria().trim());
      }
    }

    repo.save(p);
    return resumen();
  }

  @Transactional
  public PrestamoAdminResumenDto eliminar(Long id) {
    PrestamoAdmin p = repo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimiento no encontrado"));
    if (p.getPedidoAbonoId() != null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Este préstamo está ligado a un pago del pedido. Borra el pago en Surtir.");
    }
    if (p.getApartadoId() != null) {
      try {
        apartadoService.eliminar(p.getApartadoId());
      } catch (ResponseStatusException ex) {
        if (ex.getStatusCode() != HttpStatus.NOT_FOUND) {
          throw ex;
        }
      }
    }
    repo.delete(p);
    return resumen();
  }

  /** Al pagar proveedor con dinero propio. */
  @Transactional
  public void registrarPrestamoPorAbono(Long pedidoId, Long abonoId, LocalDate fecha, BigDecimal monto, String nota) {
    PrestamoAdmin p = new PrestamoAdmin();
    p.setFecha(fecha);
    p.setMonto(monto.setScale(2, RoundingMode.HALF_UP));
    p.setTipo(TipoPrestamoAdmin.PRESTAMO);
    p.setPedidoId(pedidoId);
    p.setPedidoAbonoId(abonoId);
    String n = nota != null && !nota.isBlank() ? nota.trim() : "Pago a proveedor con mi dinero";
    p.setNota(n);
    repo.save(p);
  }

  @Transactional
  public void actualizarPorAbono(Long abonoId, LocalDate fecha, BigDecimal monto, String nota) {
    PrestamoAdmin p = repo.findByPedidoAbonoId(abonoId).orElse(null);
    if (p == null) return;
    p.setFecha(fecha);
    p.setMonto(monto.setScale(2, RoundingMode.HALF_UP));
    if (nota != null && !nota.isBlank()) {
      p.setNota(nota.trim());
    }
    repo.save(p);
  }

  @Transactional
  public void borrarPorAbono(Long abonoId) {
    if (abonoId == null) return;
    repo.deleteByPedidoAbonoId(abonoId);
  }

  private PrestamoAdminDto toDto(PrestamoAdmin p) {
    return new PrestamoAdminDto(
        p.getId(),
        p.getFecha(),
        nz(p.getMonto()).setScale(2, RoundingMode.HALF_UP),
        p.getTipo().name(),
        p.getNota(),
        p.getPedidoId(),
        p.getPedidoAbonoId(),
        p.getCategoria());
  }

  private static BigDecimal nz(BigDecimal v) {
    return v != null ? v : BigDecimal.ZERO;
  }
}
