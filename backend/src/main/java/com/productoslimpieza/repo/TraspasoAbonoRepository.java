package com.productoslimpieza.repo;

import com.productoslimpieza.domain.TraspasoAbono;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TraspasoAbonoRepository extends JpaRepository<TraspasoAbono, Long> {

  List<TraspasoAbono> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(a.monto), 0) from TraspasoAbono a")
  BigDecimal sumMonto();
}
