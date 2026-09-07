package com.productoslimpieza.repo;

import com.productoslimpieza.domain.MovimientoCaja;
import com.productoslimpieza.domain.TipoMovimientoCaja;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {
  List<MovimientoCaja> findByTipoOrderByFechaDescIdDesc(TipoMovimientoCaja tipo);

  List<MovimientoCaja> findByTipoAndFechaBetweenOrderByFechaDescIdDesc(
      TipoMovimientoCaja tipo, LocalDate desde, LocalDate hasta);

  List<MovimientoCaja> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(m.monto), 0) from MovimientoCaja m where m.tipo = :tipo")
  BigDecimal sumByTipo(@Param("tipo") TipoMovimientoCaja tipo);

  @Query("""
      select coalesce(sum(m.monto), 0) from MovimientoCaja m
      where m.tipo = :tipo and m.fecha between :desde and :hasta
      """)
  BigDecimal sumByTipoAndFecha(
      @Param("tipo") TipoMovimientoCaja tipo,
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta);
}
