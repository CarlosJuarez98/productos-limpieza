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
import com.productoslimpieza.web.dto.RecetaDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PedidoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private static final List<TipoVenta> TIPOS_UNIDADES =
      List.of(
          TipoVenta.LITROS,
          TipoVenta.PIEZA,
          TipoVenta.MUESTRA,
          TipoVenta.CASA,
          TipoVenta.MAYOREO);

  private final ProductoRepository productoRepo;
  private final VentaRepository ventaRepo;
  private final TraspasoLineaRepository traspasoLineaRepo;
  private final InventarioService inventarioService;
  private final PrecioService precioService;
  private final PedidoRegistroService pedidoRegistroService;
  private final RecetaService recetaService;

  public PedidoService(
      ProductoRepository productoRepo,
      VentaRepository ventaRepo,
      TraspasoLineaRepository traspasoLineaRepo,
      InventarioService inventarioService,
      PrecioService precioService,
      PedidoRegistroService pedidoRegistroService,
      RecetaService recetaService) {
    this.productoRepo = productoRepo;
    this.ventaRepo = ventaRepo;
    this.traspasoLineaRepo = traspasoLineaRepo;
    this.inventarioService = inventarioService;
    this.precioService = precioService;
    this.pedidoRegistroService = pedidoRegistroService;
    this.recetaService = recetaService;
  }

  @Transactional
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
    BigDecimal escala =
        BigDecimal.valueOf(diasCob).divide(BigDecimal.valueOf(diasObs), 8, RoundingMode.HALF_UP);

    Map<Long, BigDecimal> faltantes = pedidoRegistroService.faltantesAbiertosPorProducto();
    Map<Long, Producto> productos = new HashMap<>();
    for (Producto p : productoRepo.findAll()) {
      productos.put(p.getId(), p);
    }
    Map<Long, RecetaDto> recetasPorResultado = new HashMap<>();
    for (RecetaDto r : recetaService.listar()) {
      recetasPorResultado.put(r.productoResultadoId(), r);
    }
    Set<Long> preparables = recetasPorResultado.keySet();

    List<PedidoLineaDto> lineas = new ArrayList<>();
    for (Producto p : productos.values()) {
      if (!p.isActivo()) continue;
      if (preparables.contains(p.getId())) {
        continue;
      }
      BigDecimal observado = consumoPeriodo(p, ini, fin);
      BigDecimal base = observado.multiply(escala);
      BigDecimal stock = inventarioService.stockActual(p);
      BigDecimal conColchon = base.multiply(factor);
      BigDecimal faltAnte = nz(faltantes.get(p.getId())).setScale(2, RoundingMode.HALF_UP);
      UnidadVenta unidad = p.getVendePor() != null ? p.getVendePor() : UnidadVenta.LITROS;

      BigDecimal necesidad = conColchon.subtract(stock).add(faltAnte);
      if (necesidad.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }

      BigDecimal sugerido = necesidad.setScale(0, RoundingMode.CEILING);
      if (sugerido.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }

      lineas.add(
          new PedidoLineaDto(
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

    List<InsumoAlertaDto> alertas =
        alertasInsumos(ini, fin, escala, factor, productos, recetasPorResultado);
    if (alertas.isEmpty() && !huboConsumoPreparables(ini, fin, productos, preparables)) {
      LocalDate prevFin = ini.minusDays(1);
      LocalDate prevIni = prevFin.withDayOfMonth(1);
      int diasPrev = (int) ChronoUnit.DAYS.between(prevIni, prevFin) + 1;
      if (diasPrev < 1) diasPrev = 1;
      BigDecimal escalaPrev =
          BigDecimal.valueOf(diasCob).divide(BigDecimal.valueOf(diasPrev), 8, RoundingMode.HALF_UP);
      alertas = alertasInsumos(prevIni, prevFin, escalaPrev, factor, productos, recetasPorResultado);
    }
    incorporarInsumosEnLineas(lineas, alertas, productos);

    lineas.sort(
        Comparator.comparing(PedidoLineaDto::faltanteAnterior, Comparator.reverseOrder())
            .thenComparing(PedidoLineaDto::consumoBase, Comparator.reverseOrder())
            .thenComparing(PedidoLineaDto::sugerido, Comparator.reverseOrder())
            .thenComparing(PedidoLineaDto::productoNombre, String.CASE_INSENSITIVE_ORDER));

    return new PedidoSugeridoDto(
        ini, fin, diasObs, diasCob, pct.setScale(2, RoundingMode.HALF_UP), lineas, alertas);
  }

  private void incorporarInsumosEnLineas(
      List<PedidoLineaDto> lineas, List<InsumoAlertaDto> alertas, Map<Long, Producto> productos) {
    for (InsumoAlertaDto a : alertas) {
      if (a.sugeridoPedir() == null || a.sugeridoPedir().compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      boolean ya = lineas.stream().anyMatch(l -> l.productoId().equals(a.productoInsumoId()));
      if (ya) continue;
      Producto insumo = productos.get(a.productoInsumoId());
      if (insumo == null) continue;
      UnidadVenta unidad = insumo.getVendePor() != null ? insumo.getVendePor() : UnidadVenta.LITROS;
      lineas.add(
          new PedidoLineaDto(
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
      LocalDate ini, LocalDate fin, Map<Long, Producto> productos, Set<Long> preparables) {
    for (Long id : preparables) {
      Producto resultado = productos.get(id);
      if (resultado == null || !resultado.isActivo()) continue;
      if (consumoPeriodo(resultado, ini, fin).compareTo(BigDecimal.ZERO) > 0) {
        return true;
      }
    }
    return false;
  }

  private List<InsumoAlertaDto> alertasInsumos(
      LocalDate ini,
      LocalDate fin,
      BigDecimal escala,
      BigDecimal factor,
      Map<Long, Producto> productos,
      Map<Long, RecetaDto> recetasPorResultado) {
    Map<Long, InsumoAlertaDto> porInsumo = new HashMap<>();
    for (RecetaDto receta : recetasPorResultado.values()) {
      Producto resultado = productos.get(receta.productoResultadoId());
      Producto insumo = productos.get(receta.productoInsumoId());
      if (resultado == null || !resultado.isActivo()) continue;
      if (insumo == null || !insumo.isActivo()) continue;

      BigDecimal consumoObs = consumoPeriodo(resultado, ini, fin);
      BigDecimal demanda = consumoObs.multiply(escala).multiply(factor);
      BigDecimal stockRes = inventarioService.stockActual(resultado);
      BigDecimal aProducir = demanda.subtract(stockRes);
      if (aProducir.compareTo(BigDecimal.ZERO) < 0) {
        aProducir = BigDecimal.ZERO;
      }

      BigDecimal ratio = ratioInsumo(receta);
      BigDecimal stockIns = inventarioService.stockActual(insumo);
      BigDecimal insumoNecesario = aProducir.multiply(ratio);
      BigDecimal pedir = insumoNecesario.subtract(stockIns);

      if (stockIns.compareTo(BigDecimal.ZERO) <= 0 && demanda.compareTo(BigDecimal.ZERO) > 0) {
        pedir = pedir.max(demanda.multiply(ratio));
        if (insumoNecesario.compareTo(BigDecimal.ZERO) <= 0) {
          insumoNecesario = demanda.multiply(ratio);
        }
      }

      if (demanda.compareTo(BigDecimal.ZERO) <= 0 && aProducir.compareTo(BigDecimal.ZERO) <= 0) {
        continue;
      }
      if (pedir.compareTo(BigDecimal.ZERO) < 0) {
        pedir = BigDecimal.ZERO;
      }

      String recetaTxt =
          strip(receta.cantidadInsumo())
              + " L "
              + insumo.getNombre()
              + " + "
              + strip(receta.cantidadAgua())
              + " L agua = "
              + strip(receta.cantidadProducto())
              + " L "
              + resultado.getNombre();
      String motivo =
          recetaTxt
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

  private static BigDecimal ratioInsumo(RecetaDto r) {
    BigDecimal p = nz(r.cantidadProducto());
    if (p.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
    return nz(r.cantidadInsumo()).divide(p, 8, RoundingMode.HALF_UP);
  }

  private static String strip(BigDecimal v) {
    return nz(v).stripTrailingZeros().toPlainString();
  }

  private BigDecimal consumoPeriodo(Producto p, LocalDate desde, LocalDate hasta) {
    BigDecimal unidades =
        nz(ventaRepo.sumCantidadByProductoTiposAndFecha(p, TIPOS_UNIDADES, desde, hasta));
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
