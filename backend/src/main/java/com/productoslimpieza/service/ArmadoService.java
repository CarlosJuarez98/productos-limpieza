package com.productoslimpieza.service;

import com.productoslimpieza.domain.AjusteInventario;
import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.AjusteInventarioRepository;
import com.productoslimpieza.repo.ProductoRepository;
import com.productoslimpieza.tenant.TenantGuard;
import com.productoslimpieza.web.dto.ArmadoDto;
import com.productoslimpieza.web.dto.ArmadoRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ArmadoService {

  private static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

  private final ProductoRepository productoRepo;
  private final AjusteInventarioRepository ajusteRepo;
  private final InventarioService inventarioService;

  public ArmadoService(
      ProductoRepository productoRepo,
      AjusteInventarioRepository ajusteRepo,
      InventarioService inventarioService) {
    this.productoRepo = productoRepo;
    this.ajusteRepo = ajusteRepo;
    this.inventarioService = inventarioService;
  }

  @Transactional
  public ArmadoDto armar(ArmadoRequest req) {
    Producto p =
        productoRepo
            .findById(req.productoId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
    TenantGuard.assertOwned(p);
    if (!p.isActivo()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto inactivo");
    }
    if (!p.isUsaBaston()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Este producto no está en la lista de Armar");
    }
    BigDecimal cant = req.cantidad().setScale(0, RoundingMode.HALF_UP);
    if (cant.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica cuántas unidades armar");
    }
    BigDecimal pendiente = nz(p.getPendienteArmar());
    if (cant.compareTo(pendiente) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Solo hay "
              + pendiente.stripTrailingZeros().toPlainString()
              + " pendientes de armar");
    }
    BigDecimal porUnidad = InventarioService.bastonesPorUnidad(p);
    BigDecimal bastonesNecesarios = cant.multiply(porUnidad).setScale(2, RoundingMode.HALF_UP);

    Producto baston = inventarioService.resolverBaston(p);
    BigDecimal stockBaston = inventarioService.stockActual(baston);
    if (bastonesNecesarios.compareTo(stockBaston) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "No hay bastones suficientes (hay "
              + stockBaston.stripTrailingZeros().toPlainString()
              + ", necesitas "
              + bastonesNecesarios.stripTrailingZeros().toPlainString()
              + "). En Surtir puedes pedir más bastones.");
    }

    AjusteInventario ajuste = new AjusteInventario();
    ajuste.setFecha(LocalDate.now(ZONA));
    ajuste.setProducto(baston);
    ajuste.setCantidad(bastonesNecesarios.negate());
    ajuste.setMotivo("Armar «" + p.getNombre() + "» × " + cant.stripTrailingZeros().toPlainString());
    ajusteRepo.save(ajuste);

    // Lista Armar: costo listo = cabeza (lo que pagaste en Surtir) + bastón por unidad.
    BigDecimal stockProd = inventarioService.stockActual(p);
    BigDecimal costoBastonUnit = inventarioService.costoBastonPorUnidad(p);
    BigDecimal compraActual = nz(p.getPrecioCompra());
    if (costoBastonUnit.compareTo(BigDecimal.ZERO) > 0 && stockProd.compareTo(BigDecimal.ZERO) > 0) {
      BigDecimal cabeza;
      if (pendiente.compareTo(stockProd) == 0) {
        // Todo el stock estaba pendiente → compra actual es solo la cabeza.
        cabeza = compraActual;
      } else {
        // Ya había armadas: si compra ya incluye bastón, la cabeza es compra − bastón;
        // si alguien dejó la compra en solo-cabeza, no restamos de más.
        BigDecimal talvezCabeza = compraActual.subtract(costoBastonUnit);
        cabeza =
            talvezCabeza.compareTo(BigDecimal.ZERO) >= 0 ? talvezCabeza : compraActual;
      }
      p.setPrecioCompra(cabeza.add(costoBastonUnit).setScale(4, RoundingMode.HALF_UP));
    }

    p.setPendienteArmar(pendiente.subtract(cant).max(BigDecimal.ZERO));
    productoRepo.save(p);

    return new ArmadoDto(
        p.getId(),
        p.getNombre(),
        cant,
        bastonesNecesarios,
        baston.getId(),
        baston.getNombre(),
        nz(p.getPendienteArmar()),
        nz(p.getPrecioCompra()));
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }
}
