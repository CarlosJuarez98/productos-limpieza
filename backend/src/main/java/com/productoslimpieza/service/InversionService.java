package com.productoslimpieza.service;

import com.productoslimpieza.domain.InversionItem;
import com.productoslimpieza.repo.InversionRepository;
import com.productoslimpieza.web.dto.InversionItemDto;
import com.productoslimpieza.web.dto.InversionResumenDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InversionService {

  private final InversionRepository inversionRepo;

  public InversionService(InversionRepository inversionRepo) {
    this.inversionRepo = inversionRepo;
  }

  @Transactional(readOnly = true)
  public InversionResumenDto resumen() {
    List<InversionItem> all = inversionRepo.findAllByOrderByTipoAscConceptoAsc();
    BigDecimal productos = BigDecimal.ZERO;
    BigDecimal infra = BigDecimal.ZERO;
    for (InversionItem i : all) {
      BigDecimal monto = i.getMonto() != null ? i.getMonto() : BigDecimal.ZERO;
      if ("PRODUCTO".equals(i.getTipo())) {
        productos = productos.add(monto);
      } else {
        infra = infra.add(monto);
      }
    }
    List<InversionItemDto> items = all.stream()
        .map(i -> new InversionItemDto(
            i.getId(), i.getTipo(), i.getConcepto(),
            i.getCantidad(), i.getPrecioUnidad(), i.getMonto()))
        .toList();
    return new InversionResumenDto(
        productos.setScale(2, RoundingMode.HALF_UP),
        infra.setScale(2, RoundingMode.HALF_UP),
        productos.add(infra).setScale(2, RoundingMode.HALF_UP),
        items
    );
  }
}
