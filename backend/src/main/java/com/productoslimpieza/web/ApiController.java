package com.productoslimpieza.web;

import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.web.dto.*;
import com.productoslimpieza.service.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
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
  private final ApartadoRubroService apartadoRubroService;
  private final InversionService inversionService;
  private final ProduccionService produccionService;
  private final MargenService margenService;
  private final RecetaService recetaService;
  private final TraspasoService traspasoService;
  private final PedidoService pedidoService;
  private final PedidoRegistroService pedidoRegistroService;
  private final AjusteInventarioService ajusteInventarioService;

  public ApiController(
      VentaService ventaService,
      EntradaService entradaService,
      InventarioService inventarioService,
      PrecioHistoricoService precioHistoricoService,
      CajaService cajaService,
      ApartadoService apartadoService,
      ApartadoRubroService apartadoRubroService,
      InversionService inversionService,
      ProduccionService produccionService,
      MargenService margenService,
      RecetaService recetaService,
      TraspasoService traspasoService,
      PedidoService pedidoService,
      PedidoRegistroService pedidoRegistroService,
      AjusteInventarioService ajusteInventarioService) {
    this.ventaService = ventaService;
    this.entradaService = entradaService;
    this.inventarioService = inventarioService;
    this.precioHistoricoService = precioHistoricoService;
    this.cajaService = cajaService;
    this.apartadoService = apartadoService;
    this.apartadoRubroService = apartadoRubroService;
    this.inversionService = inversionService;
    this.produccionService = produccionService;
    this.margenService = margenService;
    this.recetaService = recetaService;
    this.traspasoService = traspasoService;
    this.pedidoService = pedidoService;
    this.pedidoRegistroService = pedidoRegistroService;
    this.ajusteInventarioService = ajusteInventarioService;
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

  @PostMapping("/ventas/lote")
  public List<VentaDto> crearVentasLote(@Valid @RequestBody VentasLoteRequest req) {
    return ventaService.crearLote(req);
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

  @PostMapping("/entradas/lote")
  public List<EntradaDto> crearEntradasLote(@Valid @RequestBody EntradasLoteRequest req) {
    return entradaService.crearLote(req);
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

  @PutMapping("/producciones/{id}")
  public ProduccionDto actualizarProduccion(@PathVariable Long id, @Valid @RequestBody ProduccionRequest req) {
    return produccionService.actualizar(id, req);
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

  @DeleteMapping("/inventario/{id}")
  public void eliminarProducto(@PathVariable Long id) {
    inventarioService.eliminar(id);
  }

  @GetMapping("/ajustes-inventario")
  public List<AjusteInventarioDto> ajustesInventario() {
    return ajusteInventarioService.listar();
  }

  @PostMapping("/ajustes-inventario")
  public AjusteInventarioDto crearAjusteInventario(@Valid @RequestBody AjusteInventarioRequest req) {
    return ajusteInventarioService.crear(req);
  }

  @PutMapping("/ajustes-inventario/{id}")
  public AjusteInventarioDto actualizarAjusteInventario(
      @PathVariable Long id, @Valid @RequestBody AjusteInventarioRequest req) {
    return ajusteInventarioService.actualizar(id, req);
  }

  @DeleteMapping("/ajustes-inventario/{id}")
  public void eliminarAjusteInventario(@PathVariable Long id) {
    ajusteInventarioService.eliminar(id);
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

  @GetMapping("/recetas")
  public List<RecetaDto> recetas() {
    return recetaService.listar();
  }

  @PostMapping("/recetas")
  public RecetaDto crearReceta(@Valid @RequestBody RecetaRequest req) {
    return recetaService.crear(req);
  }

  @PutMapping("/recetas/{id}")
  public RecetaDto actualizarReceta(@PathVariable Long id, @Valid @RequestBody RecetaRequest req) {
    return recetaService.actualizar(id, req);
  }

  @DeleteMapping("/recetas/{id}")
  public void eliminarReceta(@PathVariable Long id) {
    recetaService.eliminar(id);
  }

  @GetMapping("/traspasos")
  public TraspasosResumenDto traspasos() {
    return traspasoService.resumen();
  }

  @GetMapping("/personas")
  public List<PersonaDto> personas() {
    return traspasoService.listarPersonas();
  }

  @PostMapping("/personas")
  public PersonaDto crearPersona(@Valid @RequestBody PersonaRequest req) {
    return traspasoService.crearPersona(req.nombre());
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

  @PostMapping("/apartados/lote")
  public List<ApartadoDto> crearApartadosLote(@Valid @RequestBody ApartadosLoteRequest req) {
    return apartadoService.crearLote(req);
  }

  @DeleteMapping("/apartados/{id}")
  public void eliminarApartado(@PathVariable Long id) {
    apartadoService.eliminar(id);
  }

  @GetMapping("/apartados/rubros")
  public List<ApartadoRubroDto> apartadosRubros() {
    return apartadoRubroService.listarActivos();
  }

  @PostMapping("/apartados/rubros")
  public ApartadoRubroDto crearApartadoRubro(@Valid @RequestBody ApartadoRubroRequest req) {
    return apartadoRubroService.crear(req);
  }

  @PutMapping("/apartados/rubros/{id}")
  public ApartadoRubroDto renombrarApartadoRubro(
      @PathVariable Long id, @Valid @RequestBody ApartadoRubroRequest req) {
    return apartadoRubroService.renombrar(id, req);
  }

  @DeleteMapping("/apartados/rubros/{id}")
  public void eliminarApartadoRubro(@PathVariable Long id) {
    apartadoRubroService.eliminar(id);
  }

  @GetMapping("/inversion")
  public InversionResumenDto inversion() {
    return inversionService.resumen();
  }

  @GetMapping("/pedido-sugerido")
  public PedidoSugeridoDto pedidoSugerido(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
      @RequestParam(required = false) Integer diasCobertura,
      @RequestParam(required = false) BigDecimal porcentajeExtra) {
    return pedidoService.sugerir(desde, hasta, diasCobertura, porcentajeExtra);
  }

  @GetMapping("/pedidos")
  public List<PedidoDto> pedidos() {
    return pedidoRegistroService.listar();
  }

  @GetMapping("/pedidos/abiertos")
  public List<PedidoDto> pedidosAbiertos() {
    return pedidoRegistroService.listarAbiertos();
  }

  @GetMapping("/pedidos/{id}")
  public PedidoDto pedido(@PathVariable Long id) {
    return pedidoRegistroService.obtener(id);
  }

  @PostMapping("/pedidos")
  public PedidoDto crearPedido(@Valid @RequestBody PedidoRequest req) {
    return pedidoRegistroService.crear(req);
  }

  @PostMapping("/pedidos/{id}/cerrar")
  public PedidoDto cerrarPedido(@PathVariable Long id) {
    return pedidoRegistroService.cerrar(id);
  }

  @PostMapping("/pedidos/{id}/recepcion")
  public PedidoDto registrarRecepcionPedido(
      @PathVariable Long id, @Valid @RequestBody PedidoRecepcionRequest req) {
    return pedidoRegistroService.registrarRecepcion(id, req);
  }

  @DeleteMapping("/pedidos/{id}")
  public void eliminarPedido(@PathVariable Long id) {
    pedidoRegistroService.eliminar(id);
  }

  @PostMapping("/inversion")
  public InversionItemDto crearInversion(@Valid @RequestBody InversionItemRequest req) {
    return inversionService.crear(req);
  }

  @PutMapping("/inversion/{id}")
  public InversionItemDto actualizarInversion(
      @PathVariable Long id, @Valid @RequestBody InversionItemRequest req) {
    return inversionService.actualizar(id, req);
  }

  @DeleteMapping("/inversion/{id}")
  public void eliminarInversion(@PathVariable Long id) {
    inversionService.eliminar(id);
  }
}
