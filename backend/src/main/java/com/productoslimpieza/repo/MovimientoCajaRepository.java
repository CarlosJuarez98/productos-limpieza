package com.productoslimpieza.repo;

import com.productoslimpieza.domain.MovimientoCaja;
import com.productoslimpieza.domain.TipoMovimientoCaja;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {
  List<MovimientoCaja> findByTipoOrderByFechaDescIdDesc(TipoMovimientoCaja tipo);
  List<MovimientoCaja> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(m.monto), 0) from MovimientoCaja m where m.tipo = :tipo")
  BigDecimal sumByTipo(@Param("tipo") TipoMovimientoCaja tipo);
}
