package com.productoslimpieza.service;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.repo.PrecioHistoricoRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

@Service
public class PrecioService {

  private final PrecioHistoricoRepository precioRepo;

  public PrecioService(PrecioHistoricoRepository precioRepo) {
    this.precioRepo = precioRepo;
  }

  public BigDecimal precioVigente(Producto producto, LocalDate fecha) {
    return precioRepo.findPrecioVigente(producto, fecha)
        .map(p -> p.getPrecio())
        .orElse(BigDecimal.ZERO);
  }

  public BigDecimal precioHoy(Producto producto) {
    return precioVigente(producto, LocalDate.now());
  }
}
