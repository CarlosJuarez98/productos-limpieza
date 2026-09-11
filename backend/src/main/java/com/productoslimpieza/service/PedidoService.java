package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.UnidadVenta;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.repo.TraspasoLineaRepository;
import com.productoslimpieza.repo.VentaRepository;
import com.productoslimpieza.web.dto.InsumoAlertaDto;
import com.productoslimpieza.web.dto.PedidoLineaDto;
import com.productoslimpieza.web.dto.PedidoSugeridoDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PedidoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private static final List<TipoVenta> TIPOS_UNIDADES = List.of(
      TipoVenta.LITROS,
      TipoVenta.PIEZA,
      TipoVenta.MUESTRA,
      TipoVenta.CASA,
      TipoVenta.MAYOREO);

  /** Resultado (lower) -> nombre insumo en inventario. */
  private static final Map<String, String> RECETAS = Map.ofEntries(
      Map.entry("cloro", "Hipoclorito"),
      Map.entry("fabuloso bosques", "Base Fabuloso Bosques"),
      Map.entry("fabuloso bosque de limon", "Base Fabuloso Limon"),
      Map.entry("fabuloso brisas", "Base Fabuloso Brisas"),
      Map.entry("fabuloso flores", "Base Fabuloso Flores"),
      Map.entry("fabuloso lavanda", "Base Fabuloso Lavanda"),
      Map.entry("fabuloso limon", "Base Fabuloso Limon"),
      Map.entry("fabuloso mandarina", "Base Fabuloso Mandarina"),
      Map.entry("fabuloso manzana canela", "Base Fabuloso Manzana Canela"),
      Map.entry("fabuloso frutas", "Base Fabuloso Frutas"),
      Map.entry("fabuloso chicle", "Base Fabuloso Chicle")
  );

  private final ProductoRepository productoRepo;
  private final VentaRepository ventaRepo;
  private final TraspasoLineaRepository traspasoLineaRepo;
  private final InventarioService inventarioService;
  private final PrecioService precioService;
  private final PedidoRegistroService pedidoRegistroService;

  public PedidoService(
      ProductoRepository productoRepo,
      VentaRepository ventaRepo,
      TraspasoLineaRepository traspasoLineaRepo,
      InventarioService inventarioService,
      PrecioService precioService,
      PedidoRegistroService pedidoRegistroService) {
    this.productoRepo = productoRepo;
    this.ventaRepo = ventaRepo;
    this.traspasoLineaRepo = traspasoLineaRepo;
    this.inventarioService = inventarioService;
    this.precioService = precioService;
    this.pedidoRegistroService = pedidoRegistroService;
  }

  @Transactional(readOnly = true)
  public PedidoSugeridoDto sugerir(
      LocalDate desde, LocalDate hasta, Integer diasCobertura, BigDecimal porcentajeExtra) {
    LocalDate fin = hasta != null ? hasta : LocalDate.now(ZONA);
    LocalDate ini = desde != null ? desde : fin.withDayOfMonth(1);
    if (ini.isAfter(fin)) {
      LocalDate tmp = ini;
      ini = fin;
      fin = tmp;
    }

    int diasObs = (int) ChronoUnit.DAYS.between(ini, fin) + 1;
    if (diasObs < 1) diasObs = 1;

    int diasCob = diasCobertura != null && diasCobertura > 0 ? diasCobertura : diasObs;
    if (diasCob > 366) diasCob = 366;

    BigDecimal pct = porcentajeExtra != null ? porcentajeExtra : new BigDecimal("20");
    if (pct.compareTo(BigDecimal.ZERO) < 0) pct = BigDecimal.ZERO;
    if (pct.compareTo(new BigDecimal("500")) > 0) pct = new BigDecimal("500");

    BigDecimal factor = BigDecimal.ONE.add(pct.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
    BigDecimal escala = BigDecimal.valueOf(diasCob)
        .divide(BigDecimal.valueOf(diasObs), 8, RoundingMode.HALF_UP);

    Map<Long, BigDecimal> faltantes = pedidoRegistroService.faltantesAbiertosPorProducto();
    Map<Long, Producto> productos = new HashMap<>();
    for (Producto p : productoRepo.findAll()) {
      productos.put(p.getId(), p);
    }

    List<PedidoLineaDto> lineas = new ArrayList<>();
    for (Producto p : productos.values()) {
      if (!p.isActivo()) continue;
      // Cloro / Fabuloso* salen de preparación: no pedir al proveedor.
      // Sí se piden los insumos (Hipoclorito, Bases) vía alertasInsumos.
      if (resolverInsumo(p.getNombre(), productos).isPresent()) {
        continue;
      }
      BigDecimal observado = consumoPeriodo(p, ini, fin);
      BigDecimal base = observado.multiply(escala);
      BigDecimal stock = inventarioService.stockActual(p);
      BigDecimal conColchon = base.multiply(factor);
      BigDecimal faltAnte = nz(faltantes.get(p.getId())).setScale(2, RoundingMode.HALF_UP);
      UnidadVenta unidad = p.getVendePor() != null ? p.getVendePor() : UnidadVenta.LITROS;

      // Ritmo + colchón − stock + lo que faltó de pedidos anteriores.
      BigDecimal necesidad = conColchon.subtract(stock).add(faltAnte);
      if (necesidad.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }

      BigDecimal sugerido = necesidad.setScale(0, RoundingMode.CEILING);
      if (sugerido.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }

      lineas.add(new PedidoLineaDto(
          p.getId(),
          p.getNombre(),
          unidad.name(),
          unidad.toLabel(),
          stock,
          observado.setScale(2, RoundingMode.HALF_UP),
          base.setScale(2, RoundingMode.HALF_UP),
          conColchon.setScale(2, RoundingMode.HALF_UP),
          faltAnte,
          sugerido));
    }

    List<InsumoAlertaDto> alertas = alertasInsumos(ini, fin, escala, factor, productos);
    // Periodo sin ventas de Cloro/Fabuloso (ej. mes actual vacío): usa el mes previo.
    if (alertas.isEmpty() && !huboConsumoPreparables(ini, fin, productos)) {
      LocalDate prevFin = ini.minusDays(1);
      LocalDate prevIni = prevFin.withDayOfMonth(1);
      int diasPrev = (int) ChronoUnit.DAYS.between(prevIni, prevFin) + 1;
      if (diasPrev < 1) diasPrev = 1;
      BigDecimal escalaPrev = BigDecimal.valueOf(diasCob)
          .divide(BigDecimal.valueOf(diasPrev), 8, RoundingMode.HALF_UP);
      alertas = alertasInsumos(prevIni, prevFin, escalaPrev, factor, productos);
    }
    incorporarInsumosEnLineas(lineas, alertas, productos);

    lineas.sort(Comparator
        .comparing(PedidoLineaDto::faltanteAnterior, Comparator.reverseOrder())
        .thenComparing(PedidoLineaDto::consumoBase, Comparator.reverseOrder())
        .thenComparing(PedidoLineaDto::sugerido, Comparator.reverseOrder())
        .thenComparing(PedidoLineaDto::productoNombre, String.CASE_INSENSITIVE_ORDER));

    return new PedidoSugeridoDto(
        ini, fin, diasObs, diasCob, pct.setScale(2, RoundingMode.HALF_UP), lineas, alertas);
  }

  /** Mete Hipoclorito / Bases al pedido sugerido (además del panel de alertas). */
  private void incorporarInsumosEnLineas(
      List<PedidoLineaDto> lineas,
      List<InsumoAlertaDto> alertas,
      Map<Long, Producto> productos) {
    for (InsumoAlertaDto a : alertas) {
      if (a.sugeridoPedir() == null || a.sugeridoPedir().compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      boolean ya = lineas.stream().anyMatch(l -> l.productoId().equals(a.productoInsumoId()));
      if (ya) continue;
      Producto insumo = productos.get(a.productoInsumoId());
      if (insumo == null) continue;
      UnidadVenta unidad = insumo.getVendePor() != null ? insumo.getVendePor() : UnidadVenta.LITROS;
      lineas.add(new PedidoLineaDto(
          insumo.getId(),
          insumo.getNombre(),
          unidad.name(),
          unidad.toLabel(),
          a.stockInsumo(),
          BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
          BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
          a.sugeridoPedir(),
          BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
          a.sugeridoPedir()));
    }
  }

  private boolean huboConsumoPreparables(
      LocalDate ini, LocalDate fin, Map<Long, Producto> productos) {
    for (Producto resultado : productos.values()) {
      if (!resultado.isActivo()) continue;
      if (resolverInsumo(resultado.getNombre(), productos).isEmpty()) continue;
      if (consumoPeriodo(resultado, ini, fin).compareTo(BigDecimal.ZERO) > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Si hay consumo/necesidad de Cloro o Fabuloso*, recomienda pedir Hipoclorito / Base
   * con las recetas del negocio:
   * - 1 L Hipoclorito + 4 L agua → 5 L Cloro (ratio 1/5)
   * - 1 L Base + 15 L agua → 16 L Fabuloso (ratio 1/16)
   */
  private List<InsumoAlertaDto> alertasInsumos(
      LocalDate ini,
      LocalDate fin,
      BigDecimal escala,
      BigDecimal factor,
      Map<Long, Producto> productos) {
    Map<Long, InsumoAlertaDto> porInsumo = new HashMap<>();
    for (Producto resultado : productos.values()) {
      if (!resultado.isActivo()) continue;
      Optional<Producto> insumoOpt = resolverInsumo(resultado.getNombre(), productos);
      if (insumoOpt.isEmpty()) continue;
      Producto insumo = insumoOpt.get();
      if (!insumo.isActivo()) continue;

      BigDecimal consumoObs = consumoPeriodo(resultado, ini, fin);
      BigDecimal demanda = consumoObs.multiply(escala).multiply(factor);
      BigDecimal stockRes = inventarioService.stockActual(resultado);
      // Litros de producto terminado que hay que preparar en el periodo.
      BigDecimal aProducir = demanda.subtract(stockRes);
      if (aProducir.compareTo(BigDecimal.ZERO) < 0) {
        aProducir = BigDecimal.ZERO;
      }

      BigDecimal ratio = ratioInsumoPorResultado(resultado);
      BigDecimal stockIns = inventarioService.stockActual(insumo);
      BigDecimal insumoNecesario = aProducir.multiply(ratio);
      BigDecimal pedir = insumoNecesario.subtract(stockIns);

      // Sin stock de base/hipo pero sí hay demanda del terminado → pide para poder preparar.
      if (stockIns.compareTo(BigDecimal.ZERO) <= 0 && demanda.compareTo(BigDecimal.ZERO) > 0) {
        pedir = pedir.max(demanda.multiply(ratio));
        if (insumoNecesario.compareTo(BigDecimal.ZERO) <= 0) {
          insumoNecesario = demanda.multiply(ratio);
        }
      }

      // Sin demanda ni falta de producción, no alertar.
      if (demanda.compareTo(BigDecimal.ZERO) <= 0 && aProducir.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      // Si ya tienes de sobra el insumo, igual mostramos el cálculo (pedir 0).
      if (pedir.compareTo(BigDecimal.ZERO) < 0) {
        pedir = BigDecimal.ZERO;
      }

      String receta =
          esCloro(resultado.getNombre())
              ? "1 L Hipoclorito + 4 L agua = 5 L Cloro"
              : "1 L Base + 15 L agua = 16 L Fabuloso";
      String motivo =
          receta
              + ". Para «"
              + resultado.getNombre()
              + "»: demanda ~"
              + demanda.setScale(1, RoundingMode.HALF_UP)
              + " L, stock producto "
              + stockRes.setScale(1, RoundingMode.HALF_UP)
              + " L → preparar ~"
              + aProducir.setScale(1, RoundingMode.HALF_UP)
              + " L (insumo ~"
              + insumoNecesario.setScale(2, RoundingMode.HALF_UP)
              + " L; tienes "
              + stockIns.setScale(1, RoundingMode.HALF_UP)
              + " L)";

      InsumoAlertaDto prev = porInsumo.get(insumo.getId());
      BigDecimal sugerido = pedir.setScale(0, RoundingMode.CEILING);
      if (prev != null) {
        sugerido = prev.sugeridoPedir().add(sugerido);
        motivo = prev.motivo() + "; también " + resultado.getNombre();
      }
      porInsumo.put(
          insumo.getId(),
          new InsumoAlertaDto(
              insumo.getId(),
              insumo.getNombre(),
              resultado.getId(),
              resultado.getNombre(),
              stockIns.setScale(2, RoundingMode.HALF_UP),
              stockRes.setScale(2, RoundingMode.HALF_UP),
              sugerido,
              motivo));
    }
    return porInsumo.values().stream()
        .sorted(Comparator.comparing(InsumoAlertaDto::sugeridoPedir).reversed())
        .toList();
  }

  /** Litros de insumo por litro de producto terminado. */
  private BigDecimal ratioInsumoPorResultado(Producto resultado) {
    if (esCloro(resultado.getNombre())) {
      // 1 Hipoclorito → 5 Cloro
      return new BigDecimal("0.2");
    }
    // 1 Base → 16 Fabuloso
    return new BigDecimal("0.0625");
  }

  private static boolean esCloro(String nombre) {
    return "cloro".equals(normalizar(nombre));
  }

  private Optional<Producto> resolverInsumo(String nombreResultado, Map<Long, Producto> productos) {
    String key = normalizar(nombreResultado);
    // Solo Cloro (no gel / pastilla) y Fabuloso*.
    if (!"cloro".equals(key) && !key.startsWith("fabuloso ")) {
      return Optional.empty();
    }
    String insumoNombre = RECETAS.get(key);
    if (insumoNombre == null && key.startsWith("fabuloso ")) {
      String resto = nombreResultado.trim();
      int idx = resto.toLowerCase(Locale.ROOT).indexOf("fabuloso");
      if (idx >= 0) {
        resto = resto.substring(idx + "fabuloso".length()).trim();
        insumoNombre = "Base Fabuloso " + resto;
      }
    }
    if (insumoNombre == null) return Optional.empty();
    final String buscarNorm = normalizar(insumoNombre);
    return productos.values().stream()
        .filter(p -> p.getNombre() != null && normalizar(p.getNombre()).equals(buscarNorm))
        .findFirst();
  }

  private static String normalizar(String s) {
    return s == null ? "" : s.trim().toLowerCase(Locale.ROOT)
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u");
  }

  private BigDecimal consumoPeriodo(Producto p, LocalDate desde, LocalDate hasta) {
    BigDecimal unidades = nz(ventaRepo.sumCantidadByProductoTiposAndFecha(p, TIPOS_UNIDADES, desde, hasta));
    BigDecimal pesos = nz(ventaRepo.sumCantidadByProductoTipoAndFecha(p, TipoVenta.PESOS, desde, hasta));
    BigDecimal precio = precioService.precioHoy(p);
    BigDecimal equivPesos = BigDecimal.ZERO;
    if (precio.compareTo(BigDecimal.ZERO) > 0 && pesos.compareTo(BigDecimal.ZERO) > 0) {
      equivPesos = pesos.divide(precio, 4, RoundingMode.HALF_UP);
    }
    BigDecimal traspasos = nz(traspasoLineaRepo.sumCantidadByProductoAndFecha(p, desde, hasta));
    return unidades.add(equivPesos).add(traspasos);
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
