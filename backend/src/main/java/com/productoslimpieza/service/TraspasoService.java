package com.productoslimpieza.service;

import com.productoslimpieza.domain.CajaConfig;
import com.productoslimpieza.domain.Persona;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoMovimientoCaja;
import com.productoslimpieza.domain.Traspaso;
import com.productoslimpieza.domain.TraspasoAbono;
import com.productoslimpieza.domain.TraspasoLinea;
import com.productoslimpieza.repo.CajaConfigRepository;
import com.productoslimpieza.repo.PersonaRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.TraspasoAbonoRepository;
import com.productoslimpieza.repo.TraspasoRepository;
import com.productoslimpieza.tenant.TenantContext;
import com.productoslimpieza.web.dto.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TraspasoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final TraspasoRepository traspasoRepo;
  private final TraspasoAbonoRepository abonoRepo;
  private final ProductoRepository productoRepo;
  private final PersonaRepository personaRepo;
  private final InventarioService inventarioService;
  private final CajaService cajaService;
  private final CajaConfigRepository cajaConfigRepo;

  public TraspasoService(
      TraspasoRepository traspasoRepo,
      TraspasoAbonoRepository abonoRepo,
      ProductoRepository productoRepo,
      PersonaRepository personaRepo,
      InventarioService inventarioService,
      CajaService cajaService,
      CajaConfigRepository cajaConfigRepo) {
    this.traspasoRepo = traspasoRepo;
    this.abonoRepo = abonoRepo;
    this.productoRepo = productoRepo;
    this.personaRepo = personaRepo;
    this.inventarioService = inventarioService;
    this.cajaService = cajaService;
    this.cajaConfigRepo = cajaConfigRepo;
  }

  @Transactional
  public TraspasosResumenDto resumen() {
    migrarPersonasLegado();
    migrarLineasLegado();
    consolidarMismaFechaPersona();
    vincularAbonosSinCaja();

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
    validarFechaNoFutura(req.fecha());
    Map<Long, Producto> productos = validarLineasYStock(req, Map.of());

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
      appendNota(t, notaTraspaso(req.nota(), algunaMuestra(req)));
    } else {
      t = new Traspaso();
      t.setFecha(req.fecha());
      t.setPersona(persona);
      t.setPersonaNombre(persona.getNombre());
      t.setNota(notaTraspaso(req.nota(), algunaMuestra(req)));
    }

    for (TraspasoLineaRequest lineaReq : req.lineas()) {
      Producto prod = productos.get(lineaReq.productoId());
      boolean muestra = Boolean.TRUE.equals(lineaReq.muestra());
      BigDecimal precio = muestra ? BigDecimal.ZERO : nz(prod.getPrecioCompra());
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
  public TraspasoDto actualizar(Long id, TraspasoRequest req) {
    validarFechaNoFutura(req.fecha());
    Traspaso t = traspasoRepo.findWithDetallesById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Traspaso no encontrado"));

    Map<Long, BigDecimal> credito = new HashMap<>();
    for (TraspasoLinea l : t.getLineas()) {
      if (l.getProducto() == null) continue;
      credito.merge(l.getProducto().getId(), nz(l.getCantidad()), BigDecimal::add);
    }
    Map<Long, Producto> productos = validarLineasYStock(req, credito);

    Persona persona = obtenerOCrearPersona(req.persona());
    t.setFecha(req.fecha());
    t.setPersona(persona);
    t.setPersonaNombre(persona.getNombre());
    t.setNota(notaTraspaso(req.nota(), algunaMuestra(req)));

    t.getLineas().clear();
    for (TraspasoLineaRequest lineaReq : req.lineas()) {
      Producto prod = productos.get(lineaReq.productoId());
      boolean muestra = Boolean.TRUE.equals(lineaReq.muestra());
      BigDecimal precio = muestra ? BigDecimal.ZERO : nz(prod.getPrecioCompra());
      agregarOSumarLinea(t, prod, lineaReq.cantidad(), precio);
    }
    recalcularTotal(t);
    traspasoRepo.saveAndFlush(t);

    List<Traspaso> mismos = traspasoRepo.findByFechaAndPersonaIdWithDetalles(req.fecha(), persona.getId());
    for (Traspaso otro : mismos) {
      if (otro.getId() != null && !otro.getId().equals(id)) {
        fusionarTraspasoEn(t, otro);
      }
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
    validarFechaNoFutura(req.fecha());
    if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica un monto mayor a cero");
    }
    if (req.personaId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista");
    }
    Persona persona = personaRepo.findById(req.personaId())
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista"));
    BigDecimal monto = req.monto().setScale(2, RoundingMode.HALF_UP);
    String nota = blankToNull(req.nota());
    boolean tarjeta = Boolean.TRUE.equals(req.pagoTarjeta());
    String motivo = motivoPagoTraspaso(persona.getNombre(), nota, tarjeta);

    TraspasoAbono a = new TraspasoAbono();
    a.setFecha(req.fecha());
    a.setMonto(monto);
    a.setPersona(persona);
    a.setPersonaNombre(persona.getNombre());
    a.setNota(nota);
    a.setPagoTarjeta(tarjeta);
    if (!tarjeta) {
      MovimientoCajaDto ingreso =
          cajaService.crearMovimiento(
              new MovimientoCajaRequest(req.fecha(), TipoMovimientoCaja.INGRESO, monto, motivo));
      a.setMovimientoCajaId(ingreso.id());
    }
    TraspasoAbono saved = abonoRepo.save(a);
    if (saved.getPersona() != null) {
      saved.getPersona().getNombre();
    }
    return toAbonoDto(saved);
  }

  @Transactional
  public void eliminarAbono(Long id) {
    TraspasoAbono a = abonoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Abono no encontrado"));
    Long movId = a.getMovimientoCajaId();
    abonoRepo.delete(a);
    if (movId != null) {
      try {
        cajaService.eliminarMovimiento(movId);
      } catch (ResponseStatusException ignored) {
        // Ya no está en caja (borrado manual); el abono igual se elimina.
      }
    }
  }

  @Transactional
  public TraspasoAbonoDto actualizarAbono(Long id, TraspasoAbonoRequest req) {
    TraspasoAbono a = abonoRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Abono no encontrado"));
    validarFechaNoFutura(req.fecha());
    if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica un monto mayor a cero");
    }
    if (req.personaId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista");
    }
    Persona persona = personaRepo.findById(req.personaId())
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Selecciona una persona de la lista"));
    BigDecimal monto = req.monto().setScale(2, RoundingMode.HALF_UP);
    String nota = blankToNull(req.nota());
    boolean tarjeta = Boolean.TRUE.equals(req.pagoTarjeta());
    String motivo = motivoPagoTraspaso(persona.getNombre(), nota, tarjeta);

    sincronizarMovimientoCajaAbono(a, req.fecha(), monto, motivo, tarjeta);

    a.setFecha(req.fecha());
    a.setMonto(monto);
    a.setPersona(persona);
    a.setPersonaNombre(persona.getNombre());
    a.setNota(nota);
    a.setPagoTarjeta(tarjeta);
    TraspasoAbono saved = abonoRepo.save(a);
    if (saved.getPersona() != null) {
      saved.getPersona().getNombre();
    }
    return toAbonoDto(saved);
  }

  /** Efectivo → ingreso en caja; tarjeta → quita ingreso (va al banco). */
  private void sincronizarMovimientoCajaAbono(
      TraspasoAbono a, LocalDate fecha, BigDecimal monto, String motivo, boolean tarjeta) {
    if (tarjeta) {
      Long movId = a.getMovimientoCajaId();
      a.setMovimientoCajaId(null);
      if (movId != null) {
        try {
          cajaService.eliminarMovimiento(movId);
        } catch (ResponseStatusException ignored) {
          // Movimiento ya no existe.
        }
      }
      return;
    }
    MovimientoCajaRequest movReq =
        new MovimientoCajaRequest(fecha, TipoMovimientoCaja.INGRESO, monto, motivo);
    if (a.getMovimientoCajaId() != null) {
      try {
        cajaService.actualizarMovimiento(a.getMovimientoCajaId(), movReq);
      } catch (ResponseStatusException e) {
        if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
          MovimientoCajaDto creado = cajaService.crearMovimiento(movReq);
          a.setMovimientoCajaId(creado.id());
        } else {
          throw e;
        }
      }
    } else {
      MovimientoCajaDto creado = cajaService.crearMovimiento(movReq);
      a.setMovimientoCajaId(creado.id());
    }
  }

  private static String motivoPagoTraspaso(String personaNombre, String nota, boolean tarjeta) {
    String base = tarjeta ? "Pago de traspaso (tarjeta)" : "Pago de traspaso";
    String quien = blankToNull(personaNombre);
    if (quien != null) {
      base = base + " - " + quien;
    }
    if (nota != null) {
      base = base + " | " + nota;
    }
    if (base.length() > 200) {
      return base.substring(0, 200);
    }
    return base;
  }

  /** Abonos viejos en efectivo (o creados sin backend actualizado) → ingreso en caja. */
  private void vincularAbonosSinCaja() {
    LocalDate inicioPeriodo =
        cajaConfigRepo
            .findByTenantId(TenantContext.require())
            .map(CajaConfig::getFechaInicio)
            .orElse(null);
    LocalDate hoy = LocalDate.now(ZoneId.of("America/Mexico_City"));
    for (TraspasoAbono a : abonoRepo.findAllWithPersona()) {
      if (a.isPagoTarjeta()) continue;
      if (a.getMovimientoCajaId() != null) continue;
      if (a.getMonto() == null || a.getMonto().compareTo(BigDecimal.ZERO) <= 0) continue;
      if (a.getFecha() == null) continue;
      // No invocar caja si la fecha no entraría (evita rollback-only).
      if (inicioPeriodo != null && a.getFecha().isBefore(inicioPeriodo)) continue;
      if (a.getFecha().isAfter(hoy)) continue;
      String quien =
          a.getPersona() != null ? a.getPersona().getNombre() : a.getPersonaNombre();
      String motivo = motivoPagoTraspaso(quien, a.getNota(), false);
      MovimientoCajaDto ingreso =
          cajaService.crearMovimiento(
              new MovimientoCajaRequest(
                  a.getFecha(), TipoMovimientoCaja.INGRESO, a.getMonto(), motivo));
      a.setMovimientoCajaId(ingreso.id());
      abonoRepo.save(a);
    }
  }

  private Map<Long, Producto> validarLineasYStock(TraspasoRequest req, Map<Long, BigDecimal> creditoStock) {
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
      BigDecimal stock = inventarioService.stockActual(prod).add(nz(creditoStock.get(prod.getId())));
      if (e.getValue().compareTo(stock) > 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "«" + prod.getNombre() + "»: solo hay " + stock.stripTrailingZeros().toPlainString()
                + " disponible (pediste " + e.getValue().stripTrailingZeros().toPlainString() + ")");
      }
      productos.put(prod.getId(), prod);
    }
    return productos;
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
      // Conserva precio 0 (muestra); no lo sustituyas por precio de compra.
      agregarOSumarLinea(destino, prod, nz(l.getCantidad()), nz(l.getPrecioCompra()));
    }
    appendNota(destino, blankToNull(origen.getNota()));
    traspasoRepo.delete(origen);
  }

  private void agregarOSumarLinea(Traspaso t, Producto prod, BigDecimal cantidad, BigDecimal precio) {
    for (TraspasoLinea existing : t.getLineas()) {
      if (existing.getProducto() == null || !existing.getProducto().getId().equals(prod.getId())) {
        continue;
      }
      // Solo fusiona si el precio coincide (muestra con muestra, cobrado con cobrado).
      if (nz(existing.getPrecioCompra()).compareTo(precio) != 0) {
        continue;
      }
      BigDecimal nuevaCant = nz(existing.getCantidad()).add(cantidad);
      existing.setCantidad(nuevaCant);
      existing.setPrecioCompra(precio);
      existing.setTotal(nuevaCant.multiply(precio).setScale(2, RoundingMode.HALF_UP));
      return;
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
        a.getNota(),
        a.isPagoTarjeta()
    );
  }

  private void validarFechaNoFutura(LocalDate fecha) {
    if (fecha == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha requerida");
    }
    if (fecha.isAfter(LocalDate.now(ZONA))) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "No se pueden registrar traspasos con fecha futura");
    }
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }

  /** Nota del traspaso; si hay alguna muestra, deja constancia sin duplicar la palabra. */
  private static String notaTraspaso(String nota, boolean algunaMuestra) {
    String n = blankToNull(nota);
    if (!algunaMuestra) {
      return n;
    }
    if (n == null) {
      return "Con muestra";
    }
    if (n.toLowerCase(Locale.ROOT).contains("muestra")) {
      return n;
    }
    return n + " · Con muestra";
  }

  private static boolean algunaMuestra(TraspasoRequest req) {
    if (req.lineas() == null) return false;
    for (TraspasoLineaRequest l : req.lineas()) {
      if (Boolean.TRUE.equals(l.muestra())) return true;
    }
    return false;
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
