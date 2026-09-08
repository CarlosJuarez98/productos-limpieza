package com.productoslimpieza.service;

import com.productoslimpieza.domain.Persona;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Traspaso;
import com.productoslimpieza.domain.TraspasoAbono;
import com.productoslimpieza.domain.TraspasoLinea;
import com.productoslimpieza.repo.PersonaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.TraspasoAbonoRepository;
import com.productoslimpieza.repo.TraspasoRepository;
import com.productoslimpieza.web.dto.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TraspasoService {

  private final TraspasoRepository traspasoRepo;
  private final TraspasoAbonoRepository abonoRepo;
  private final ProductoRepository productoRepo;
  private final PersonaRepository personaRepo;

  public TraspasoService(
      TraspasoRepository traspasoRepo,
      TraspasoAbonoRepository abonoRepo,
      ProductoRepository productoRepo,
      PersonaRepository personaRepo) {
    this.traspasoRepo = traspasoRepo;
    this.abonoRepo = abonoRepo;
    this.productoRepo = productoRepo;
    this.personaRepo = personaRepo;
  }

  @Transactional
  public TraspasosResumenDto resumen() {
    migrarPersonasLegado();
    migrarLineasLegado();

    List<Traspaso> traspasos = traspasoRepo.findAllByOrderByFechaDescIdDesc();
    List<TraspasoAbono> abonos = abonoRepo.findAllByOrderByFechaDescIdDesc();

    BigDecimal total = traspasos.stream()
        .map(t -> nz(t.getTotal()))
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .setScale(2, RoundingMode.HALF_UP);
    BigDecimal abonado = abonos.stream()
        .map(a -> nz(a.getMonto()))
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .setScale(2, RoundingMode.HALF_UP);

    Map<Long, Acum> porPersona = new LinkedHashMap<>();
    for (Traspaso t : traspasos) {
      Persona p = t.getPersona();
      if (p == null) continue;
      Acum a = porPersona.computeIfAbsent(p.getId(), id -> new Acum(p.getId(), p.getNombre()));
      a.traspasado = a.traspasado.add(nz(t.getTotal()));
    }
    for (TraspasoAbono ab : abonos) {
      Persona p = ab.getPersona();
      if (p == null) continue;
      Acum a = porPersona.computeIfAbsent(p.getId(), id -> new Acum(p.getId(), p.getNombre()));
      a.abonado = a.abonado.add(nz(ab.getMonto()));
    }

    List<TraspasoSaldoPersonaDto> saldos = new ArrayList<>();
    for (Acum a : porPersona.values()) {
      BigDecimal saldo = a.traspasado.subtract(a.abonado).setScale(2, RoundingMode.HALF_UP);
      String estado;
      if (saldo.compareTo(BigDecimal.ZERO) > 0) {
        estado = "DEBE";
      } else if (saldo.compareTo(BigDecimal.ZERO) < 0) {
        estado = "A_FAVOR";
      } else {
        estado = "AL_CORRIENTE";
      }
      saldos.add(new TraspasoSaldoPersonaDto(
          a.id,
          a.nombre,
          a.traspasado.setScale(2, RoundingMode.HALF_UP),
          a.abonado.setScale(2, RoundingMode.HALF_UP),
          saldo,
          estado
      ));
    }
    saldos.sort(Comparator
        .comparing((TraspasoSaldoPersonaDto s) -> !"DEBE".equals(s.estado()))
        .thenComparing(s -> s.saldo().abs(), Comparator.reverseOrder())
        .thenComparing(TraspasoSaldoPersonaDto::persona, String.CASE_INSENSITIVE_ORDER));

    List<PersonaDto> personas = personaRepo.findAllByOrderByNombreAsc().stream()
        .map(p -> new PersonaDto(p.getId(), p.getNombre()))
        .toList();

    return new TraspasosResumenDto(
        total,
        abonado,
        total.subtract(abonado).setScale(2, RoundingMode.HALF_UP),
        personas,
        saldos,
        traspasos.stream().map(this::toDto).toList(),
        abonos.stream().map(this::toAbonoDto).toList()
    );
  }

  @Transactional
  public TraspasoDto crear(TraspasoRequest req) {
    if (req.lineas() == null || req.lineas().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega al menos un producto");
    }
    Persona persona = obtenerOCrearPersona(req.persona());
    Traspaso t = new Traspaso();
    t.setFecha(req.fecha());
    t.setPersona(persona);
    t.setPersonaNombre(persona.getNombre());
    t.setNota(blankToNull(req.nota()));

    BigDecimal total = BigDecimal.ZERO;
    for (TraspasoLineaRequest lineaReq : req.lineas()) {
      Producto prod = productoRepo.findById(lineaReq.productoId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
      if (!prod.isActivo()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El producto está dado de baja del inventario");
      }
      BigDecimal precio = nz(prod.getPrecioCompra());
      BigDecimal lineaTotal = lineaReq.cantidad().multiply(precio).setScale(2, RoundingMode.HALF_UP);
      TraspasoLinea linea = new TraspasoLinea();
      linea.setProducto(prod);
      linea.setCantidad(lineaReq.cantidad());
      linea.setPrecioCompra(precio);
      linea.setTotal(lineaTotal);
      t.addLinea(linea);
      total = total.add(lineaTotal);
    }
    t.setTotal(total.setScale(2, RoundingMode.HALF_UP));
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
    if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica un monto mayor a cero");
    }
    Persona persona = personaRepo.findById(req.personaId())
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista"));
    TraspasoAbono a = new TraspasoAbono();
    a.setFecha(req.fecha());
    a.setMonto(req.monto().setScale(2, RoundingMode.HALF_UP));
    a.setPersona(persona);
    a.setPersonaNombre(persona.getNombre());
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

  private void migrarPersonasLegado() {
    for (Traspaso t : traspasoRepo.findAll()) {
      if (t.getPersona() != null) continue;
      String nombre = blankToNull(t.getPersonaNombre());
      if (nombre == null) continue;
      Persona p = obtenerOCrearPersona(nombre);
      t.setPersona(p);
      t.setPersonaNombre(p.getNombre());
      traspasoRepo.save(t);
    }
    for (TraspasoAbono a : abonoRepo.findAll()) {
      if (a.getPersona() != null) continue;
      String nombre = blankToNull(a.getPersonaNombre());
      if (nombre == null) continue;
      Persona p = obtenerOCrearPersona(nombre);
      a.setPersona(p);
      a.setPersonaNombre(p.getNombre());
      abonoRepo.save(a);
    }
  }

  /** Pasa el producto único legado a traspaso_lineas. */
  private void migrarLineasLegado() {
    for (Traspaso t : traspasoRepo.findAll()) {
      if (t.getProductoLegado() == null) continue;
      if (t.getLineas() != null && !t.getLineas().isEmpty()) {
        t.setProductoLegado(null);
        t.setCantidadLegado(null);
        t.setPrecioCompraLegado(null);
        traspasoRepo.save(t);
        continue;
      }
      BigDecimal cant = nz(t.getCantidadLegado());
      BigDecimal precio = t.getPrecioCompraLegado() != null
          ? t.getPrecioCompraLegado()
          : nz(t.getProductoLegado().getPrecioCompra());
      BigDecimal lineaTotal = cant.multiply(precio).setScale(2, RoundingMode.HALF_UP);
      if (lineaTotal.compareTo(BigDecimal.ZERO) <= 0 && t.getTotal() != null) {
        lineaTotal = nz(t.getTotal());
      }
      TraspasoLinea linea = new TraspasoLinea();
      linea.setProducto(t.getProductoLegado());
      linea.setCantidad(cant.compareTo(BigDecimal.ZERO) > 0 ? cant : BigDecimal.ONE);
      linea.setPrecioCompra(precio);
      linea.setTotal(lineaTotal);
      t.addLinea(linea);
      if (t.getTotal() == null || t.getTotal().compareTo(BigDecimal.ZERO) == 0) {
        t.setTotal(lineaTotal);
      }
      t.setProductoLegado(null);
      t.setCantidadLegado(null);
      t.setPrecioCompraLegado(null);
      traspasoRepo.save(t);
    }
  }

  private Persona obtenerOCrearPersona(String raw) {
    String nombre = blankToNull(raw);
    if (nombre == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el nombre de la persona");
    }
    return personaRepo.findByNombreIgnoreCase(nombre).orElseGet(() -> {
      Persona p = new Persona();
      p.setNombre(nombre);
      return personaRepo.save(p);
    });
  }

  private TraspasoDto toDto(Traspaso t) {
    Persona per = t.getPersona();
    List<TraspasoLineaDto> lineas = t.getLineas().stream()
        .map(l -> new TraspasoLineaDto(
            l.getId(),
            l.getProducto().getId(),
            l.getProducto().getNombre(),
            l.getCantidad(),
            l.getPrecioCompra(),
            l.getTotal()))
        .toList();
    return new TraspasoDto(
        t.getId(),
        t.getFecha(),
        per != null ? per.getId() : null,
        per != null ? per.getNombre() : t.getPersonaNombre(),
        t.getNota(),
        t.getTotal(),
        lineas
    );
  }

  private TraspasoAbonoDto toAbonoDto(TraspasoAbono a) {
    Persona per = a.getPersona();
    return new TraspasoAbonoDto(
        a.getId(),
        a.getFecha(),
        a.getMonto(),
        per != null ? per.getId() : null,
        per != null ? per.getNombre() : a.getPersonaNombre(),
        a.getNota()
    );
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }

  private static final class Acum {
    final Long id;
    final String nombre;
    BigDecimal traspasado = BigDecimal.ZERO;
    BigDecimal abonado = BigDecimal.ZERO;

    Acum(Long id, String nombre) {
      this.id = id;
      this.nombre = nombre;
    }
  }
}
