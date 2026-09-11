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
import java.util.HashMap;
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
  private final InventarioService inventarioService;

  public TraspasoService(
      TraspasoRepository traspasoRepo,
      TraspasoAbonoRepository abonoRepo,
      ProductoRepository productoRepo,
      PersonaRepository personaRepo,
      InventarioService inventarioService) {
    this.traspasoRepo = traspasoRepo;
    this.abonoRepo = abonoRepo;
    this.productoRepo = productoRepo;
    this.personaRepo = personaRepo;
    this.inventarioService = inventarioService;
  }

  @Transactional
  public TraspasosResumenDto resumen() {
    migrarPersonasLegado();
    migrarLineasLegado();
    consolidarMismaFechaPersona();

    List<Traspaso> traspasos = traspasoRepo.findAllWithDetalles();
    List<TraspasoAbono> abonos = abonoRepo.findAllWithPersona();

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

    Map<Long, BigDecimal> pedidoPorProducto = new HashMap<>();
    for (TraspasoLineaRequest lineaReq : req.lineas()) {
      if (lineaReq.productoId() == null || lineaReq.cantidad() == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada fila necesita producto y cantidad");
      }
      if (lineaReq.cantidad().compareTo(BigDecimal.ZERO) <= 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad debe ser mayor a cero");
      }
      pedidoPorProducto.merge(lineaReq.productoId(), lineaReq.cantidad(), BigDecimal::add);
    }

    Map<Long, Producto> productos = new HashMap<>();
    for (Map.Entry<Long, BigDecimal> e : pedidoPorProducto.entrySet()) {
      Producto prod = productoRepo.findById(e.getKey())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
      if (!prod.isActivo()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "El producto «" + prod.getNombre() + "» está dado de baja");
      }
      BigDecimal stock = inventarioService.stockActual(prod);
      if (e.getValue().compareTo(stock) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "«" + prod.getNombre() + "»: solo hay " + stock.stripTrailingZeros().toPlainString()
                + " disponible (pediste " + e.getValue().stripTrailingZeros().toPlainString() + ")");
      }
      productos.put(prod.getId(), prod);
    }

    Persona persona = obtenerOCrearPersona(req.persona());

    // Misma persona + misma fecha → una sola lista (agrega líneas al existente).
    List<Traspaso> mismos = traspasoRepo.findByFechaAndPersonaIdWithDetalles(req.fecha(), persona.getId());
    Traspaso t;
    if (!mismos.isEmpty()) {
      t = mismos.get(0);
      // Si había duplicados viejos, fusiónalos antes de agregar.
      for (int i = 1; i < mismos.size(); i++) {
        fusionarTraspasoEn(t, mismos.get(i));
      }
      appendNota(t, blankToNull(req.nota()));
    } else {
      t = new Traspaso();
      t.setFecha(req.fecha());
      t.setPersona(persona);
      t.setPersonaNombre(persona.getNombre());
      t.setNota(blankToNull(req.nota()));
    }

    for (TraspasoLineaRequest lineaReq : req.lineas()) {
      Producto prod = productos.get(lineaReq.productoId());
      BigDecimal precio = nz(prod.getPrecioCompra());
      if (precio.compareTo(BigDecimal.ZERO) <= 0) {
        precio = BigDecimal.ZERO;
      }
      agregarOSumarLinea(t, prod, lineaReq.cantidad(), precio);
    }
    recalcularTotal(t);
    Traspaso saved = traspasoRepo.save(t);
    saved.getLineas().forEach(l -> l.getProducto().getNombre());
    if (saved.getPersona() != null) {
      saved.getPersona().getNombre();
    }
    return toDto(saved);
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
    if (req.personaId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista");
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
    TraspasoAbono saved = abonoRepo.save(a);
    if (saved.getPersona() != null) {
      saved.getPersona().getNombre();
    }
    return toAbonoDto(saved);
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

  @Transactional(readOnly = true)
  public List<PersonaDto> listarPersonas() {
    return personaRepo.findAllByOrderByNombreAsc().stream()
        .map(p -> new PersonaDto(p.getId(), p.getNombre()))
        .toList();
  }

  @Transactional
  public PersonaDto crearPersona(String raw) {
    String nombre = blankToNull(raw);
    if (nombre == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el nombre de la persona");
    }
    if (personaRepo.findByNombreIgnoreCase(nombre).isPresent()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esa persona ya está en la lista");
    }
    Persona p = new Persona();
    p.setNombre(nombre);
    Persona saved = personaRepo.save(p);
    return new PersonaDto(saved.getId(), saved.getNombre());
  }

  /**
   * Une traspasos duplicados (misma fecha + misma persona) en uno solo.
   * Se ejecuta al cargar el resumen para limpiar historial viejo.
   */
  private void consolidarMismaFechaPersona() {
    List<Traspaso> todos = traspasoRepo.findAllWithDetalles();
    Map<String, List<Traspaso>> grupos = new LinkedHashMap<>();
    for (Traspaso t : todos) {
      if (t.getPersona() == null || t.getFecha() == null) continue;
      String key = t.getFecha() + "|" + t.getPersona().getId();
      grupos.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
    }
    for (List<Traspaso> grupo : grupos.values()) {
      if (grupo.size() < 2) continue;
      grupo.sort(Comparator.comparing(Traspaso::getId));
      Traspaso keep = grupo.get(0);
      for (int i = 1; i < grupo.size(); i++) {
        fusionarTraspasoEn(keep, grupo.get(i));
      }
      recalcularTotal(keep);
      traspasoRepo.save(keep);
    }
  }

  /** Mueve líneas y nota de {@code origen} a {@code destino} y borra origen. */
  private void fusionarTraspasoEn(Traspaso destino, Traspaso origen) {
    if (origen.getId() != null && origen.getId().equals(destino.getId())) return;
    List<TraspasoLinea> copiar = new ArrayList<>(origen.getLineas() != null ? origen.getLineas() : List.of());
    for (TraspasoLinea l : copiar) {
      Producto prod = l.getProducto();
      if (prod == null) continue;
      BigDecimal precio = nz(l.getPrecioCompra());
      if (precio.compareTo(BigDecimal.ZERO) <= 0) {
        precio = nz(prod.getPrecioCompra());
      }
      agregarOSumarLinea(destino, prod, nz(l.getCantidad()), precio);
    }
    appendNota(destino, blankToNull(origen.getNota()));
    traspasoRepo.delete(origen);
  }

  private void agregarOSumarLinea(Traspaso t, Producto prod, BigDecimal cantidad, BigDecimal precio) {
    for (TraspasoLinea existing : t.getLineas()) {
      if (existing.getProducto() != null && existing.getProducto().getId().equals(prod.getId())) {
        BigDecimal nuevaCant = nz(existing.getCantidad()).add(cantidad);
        BigDecimal p = precio.compareTo(BigDecimal.ZERO) > 0 ? precio : nz(existing.getPrecioCompra());
        existing.setCantidad(nuevaCant);
        existing.setPrecioCompra(p);
        existing.setTotal(nuevaCant.multiply(p).setScale(2, RoundingMode.HALF_UP));
        return;
      }
    }
    TraspasoLinea linea = new TraspasoLinea();
    linea.setProducto(prod);
    linea.setCantidad(cantidad);
    linea.setPrecioCompra(precio);
    linea.setTotal(cantidad.multiply(precio).setScale(2, RoundingMode.HALF_UP));
    t.addLinea(linea);
  }

  private void recalcularTotal(Traspaso t) {
    BigDecimal total = BigDecimal.ZERO;
    for (TraspasoLinea l : t.getLineas()) {
      total = total.add(nz(l.getTotal()));
    }
    t.setTotal(total.setScale(2, RoundingMode.HALF_UP));
  }

  private static void appendNota(Traspaso t, String notaNueva) {
    if (notaNueva == null) return;
    String actual = blankToNull(t.getNota());
    if (actual == null) {
      t.setNota(notaNueva);
      return;
    }
    if (actual.contains(notaNueva)) return;
    t.setNota(actual + " · " + notaNueva);
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
    List<TraspasoLinea> raw = t.getLineas() != null ? t.getLineas() : List.of();
    List<TraspasoLineaDto> lineas = raw.stream()
        .map(l -> {
          Producto prod = l.getProducto();
          return new TraspasoLineaDto(
              l.getId(),
              prod != null ? prod.getId() : null,
              prod != null ? prod.getNombre() : "—",
              l.getCantidad(),
              l.getPrecioCompra(),
              l.getTotal());
        })
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
