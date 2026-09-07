package com.productoslimpieza.web;

import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.web.dto.*;
import com.productoslimpieza.service.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {

  private final VentaService ventaService;
  private final EntradaService entradaService;
  private final InventarioService inventarioService;
  private final PrecioHistoricoService precioHistoricoService;
  private final CajaService cajaService;
  private final ApartadoService apartadoService;
  private final InversionService inversionService;
  private final ProduccionService produccionService;
  private final MargenService margenService;
  private final TraspasoService traspasoService;

  public ApiController(
      VentaService ventaService,
      EntradaService entradaService,
      InventarioService inventarioService,
      PrecioHistoricoService precioHistoricoService,
      CajaService cajaService,
      ApartadoService apartadoService,
      InversionService inversionService,
      ProduccionService produccionService,
      MargenService margenService,
      TraspasoService traspasoService) {
    this.ventaService = ventaService;
    this.entradaService = entradaService;
    this.inventarioService = inventarioService;
    this.precioHistoricoService = precioHistoricoService;
    this.cajaService = cajaService;
    this.apartadoService = apartadoService;
    this.inversionService = inversionService;
    this.produccionService = produccionService;
    this.margenService = margenService;
    this.traspasoService = traspasoService;
  }

  @GetMapping("/ventas")
  public List<VentaDto> ventas(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
    return ventaService.listar(desde, hasta);
  }

  @GetMapping("/casa")
  public List<VentaDto> usoCasa() {
    return ventaService.listarPorTipo(TipoVenta.CASA);
  }

  @PostMapping("/ventas")
  public VentaDto crearVenta(@Valid @RequestBody VentaRequest req) {
    return ventaService.crear(req);
  }

  @PutMapping("/ventas/{id}")
  public VentaDto actualizarVenta(@PathVariable Long id, @Valid @RequestBody VentaRequest req) {
    return ventaService.actualizar(id, req);
  }

  @DeleteMapping("/ventas/{id}")
  public void eliminarVenta(@PathVariable Long id) {
    ventaService.eliminar(id);
  }

  @GetMapping("/entradas")
  public List<EntradaDto> entradas() {
    return entradaService.listar();
  }

  @PostMapping("/entradas")
  public EntradaDto crearEntrada(@Valid @RequestBody EntradaRequest req) {
    return entradaService.crear(req);
  }

  @PutMapping("/entradas/{id}")
  public EntradaDto actualizarEntrada(@PathVariable Long id, @Valid @RequestBody EntradaRequest req) {
    return entradaService.actualizar(id, req);
  }

  @DeleteMapping("/entradas/{id}")
  public void eliminarEntrada(@PathVariable Long id) {
    entradaService.eliminar(id);
  }

  @GetMapping("/producciones")
  public List<ProduccionDto> producciones() {
    return produccionService.listar();
  }

  @GetMapping("/producciones/receta/{productoResultadoId}")
  public RecetaSugeridaDto recetaProduccion(@PathVariable Long productoResultadoId) {
    return produccionService.sugerir(productoResultadoId);
  }

  @PostMapping("/producciones")
  public ProduccionDto crearProduccion(@Valid @RequestBody ProduccionRequest req) {
    return produccionService.crear(req);
  }

  @DeleteMapping("/producciones/{id}")
  public void eliminarProduccion(@PathVariable Long id) {
    produccionService.eliminar(id);
  }

  @GetMapping("/inventario")
  public List<InventarioDto> inventario() {
    return inventarioService.listar();
  }

  @PostMapping("/inventario")
  public InventarioDto crearProducto(@Valid @RequestBody ProductoRequest req) {
    return inventarioService.crear(req);
  }

  @PutMapping("/inventario/{id}")
  public InventarioDto actualizarProducto(@PathVariable Long id, @Valid @RequestBody ProductoRequest req) {
    return inventarioService.actualizar(id, req);
  }

  @GetMapping("/margenes")
  public MargenConfigDto margenes() {
    return margenService.dto();
  }

  @PutMapping("/margenes")
  public MargenConfigDto actualizarMargenes(@Valid @RequestBody MargenConfigRequest req) {
    return margenService.actualizar(req);
  }

  @PostMapping("/margenes/aplicar-precios")
  public MargenConfigDto aplicarPreciosDesdeMargenes() {
    return margenService.aplicarPrecios();
  }

  @GetMapping("/traspasos")
  public TraspasosResumenDto traspasos() {
    return traspasoService.resumen();
  }

  @PostMapping("/traspasos")
  public TraspasoDto crearTraspaso(@Valid @RequestBody TraspasoRequest req) {
    return traspasoService.crear(req);
  }

  @DeleteMapping("/traspasos/{id}")
  public void eliminarTraspaso(@PathVariable Long id) {
    traspasoService.eliminar(id);
  }

  @PostMapping("/traspasos/abonos")
  public TraspasoAbonoDto crearAbonoTraspaso(@Valid @RequestBody TraspasoAbonoRequest req) {
    return traspasoService.crearAbono(req);
  }

  @DeleteMapping("/traspasos/abonos/{id}")
  public void eliminarAbonoTraspaso(@PathVariable Long id) {
    traspasoService.eliminarAbono(id);
  }

  @GetMapping("/precios")
  public List<PrecioHistoricoDto> precios() {
    return precioHistoricoService.listar();
  }

  @PostMapping("/precios")
  public PrecioHistoricoDto crearPrecio(@Valid @RequestBody PrecioHistoricoRequest req) {
    return precioHistoricoService.crear(req);
  }

  @DeleteMapping("/precios/{id}")
  public void eliminarPrecio(@PathVariable Long id) {
    precioHistoricoService.eliminar(id);
  }

  @GetMapping("/lista-precios")
  public List<InventarioDto> listaPrecios() {
    return inventarioService.listar();
  }

  @GetMapping("/caja")
  public CajaResumenDto caja() {
    return cajaService.resumen();
  }

  @PutMapping("/caja/config")
  public Object cajaConfig(@RequestBody CajaConfigRequest req) {
    return cajaService.actualizarConfig(req);
  }

  @PostMapping("/caja/cortes")
  public Object marcarCorte(@Valid @RequestBody MarcarCorteRequest req) {
    return cajaService.marcarCorte(req);
  }

  @GetMapping("/caja/cortes/{fecha}")
  public CortePeriodoDto detalleCorte(
      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
    return cajaService.detalleCorte(fecha);
  }

  @PostMapping("/caja/movimientos")
  public MovimientoCajaDto crearMovimiento(@Valid @RequestBody MovimientoCajaRequest req) {
    return cajaService.crearMovimiento(req);
  }

  @DeleteMapping("/caja/movimientos/{id}")
  public void eliminarMovimiento(@PathVariable Long id) {
    cajaService.eliminarMovimiento(id);
  }

  @GetMapping("/apartados")
  public ApartadosResumenDto apartados() {
    return apartadoService.resumen();
  }

  @PostMapping("/apartados")
  public ApartadoDto crearApartado(@Valid @RequestBody ApartadoRequest req) {
    return apartadoService.crear(req);
  }

  @DeleteMapping("/apartados/{id}")
  public void eliminarApartado(@PathVariable Long id) {
    apartadoService.eliminar(id);
  }

  @GetMapping("/inversion")
  public InversionResumenDto inversion() {
    return inversionService.resumen();
  }
}
