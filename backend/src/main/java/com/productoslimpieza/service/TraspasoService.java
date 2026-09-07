package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Traspaso;
import com.productoslimpieza.domain.TraspasoAbono;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.TraspasoAbonoRepository;
import com.productoslimpieza.repo.TraspasoRepository;
import com.productoslimpieza.web.dto.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TraspasoService {

  private final TraspasoRepository traspasoRepo;
  private final TraspasoAbonoRepository abonoRepo;
  private final ProductoRepository productoRepo;

  public TraspasoService(
      TraspasoRepository traspasoRepo,
      TraspasoAbonoRepository abonoRepo,
      ProductoRepository productoRepo) {
    this.traspasoRepo = traspasoRepo;
    this.abonoRepo = abonoRepo;
    this.productoRepo = productoRepo;
  }

  @Transactional(readOnly = true)
  public TraspasosResumenDto resumen() {
    BigDecimal total = nz(traspasoRepo.sumTotal()).setScale(2, RoundingMode.HALF_UP);
    BigDecimal abonado = nz(abonoRepo.sumMonto()).setScale(2, RoundingMode.HALF_UP);
    return new TraspasosResumenDto(
        total,
        abonado,
        total.subtract(abonado).setScale(2, RoundingMode.HALF_UP),
        traspasoRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toDto).toList(),
        abonoRepo.findAllByOrderByFechaDescIdDesc().stream().map(this::toAbonoDto).toList()
    );
  }

  @Transactional
  public TraspasoDto crear(TraspasoRequest req) {
    Producto p = productoRepo.findById(req.productoId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    BigDecimal precio = nz(p.getPrecioCompra());
    Traspaso t = new Traspaso();
    t.setFecha(req.fecha());
    t.setProducto(p);
    t.setCantidad(req.cantidad());
    t.setPrecioCompra(precio);
    t.setTotal(req.cantidad().multiply(precio).setScale(2, RoundingMode.HALF_UP));
    t.setPersona(blankToNull(req.persona()));
    t.setNota(blankToNull(req.nota()));
    return toDto(traspasoRepo.save(t));
  }

  @Transactional
  public void eliminar(Long id) {
    if (!traspasoRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Traspaso no encontrado");
    }
    traspasoRepo.deleteById(id);
  }

  @Transactional
  public TraspasoAbonoDto crearAbono(TraspasoAbonoRequest req) {
    TraspasoAbono a = new TraspasoAbono();
    a.setFecha(req.fecha());
    a.setMonto(req.monto().setScale(2, RoundingMode.HALF_UP));
    a.setPersona(blankToNull(req.persona()));
    a.setNota(blankToNull(req.nota()));
    return toAbonoDto(abonoRepo.save(a));
  }

  @Transactional
  public void eliminarAbono(Long id) {
    if (!abonoRepo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Abono no encontrado");
    }
    abonoRepo.deleteById(id);
  }

  private TraspasoDto toDto(Traspaso t) {
    Producto p = t.getProducto();
    return new TraspasoDto(
        t.getId(),
        t.getFecha(),
        p.getId(),
        p.getNombre(),
        t.getCantidad(),
        t.getPrecioCompra(),
        t.getTotal(),
        t.getPersona(),
        t.getNota()
    );
  }

  private TraspasoAbonoDto toAbonoDto(TraspasoAbono a) {
    return new TraspasoAbonoDto(a.getId(), a.getFecha(), a.getMonto(), a.getPersona(), a.getNota());
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }
}
