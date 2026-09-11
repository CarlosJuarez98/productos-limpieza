package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.TipoMovimientoApartado;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApartadoRepository extends JpaRepository<Apartado, Long> {
  List<Apartado> findByCategoriaOrderByFechaDescIdDesc(String categoria);

  List<Apartado> findAllByOrderByFechaDescIdDesc();

  long countByCategoriaIgnoreCase(String categoria);

  @Query(
      """
      select coalesce(sum(a.ingreso), 0) from Apartado a
      where a.categoria = :categoria and a.tipo = :tipo
      """)
  BigDecimal sumByCategoriaAndTipo(
      @Param("categoria") String categoria, @Param("tipo") TipoMovimientoApartado tipo);

  /** Solo ingresos (dinero que sale de caja hacia apartados), en el periodo. */
  @Query(
      """
      select coalesce(sum(a.ingreso), 0) from Apartado a
      where a.categoria in :categorias
        and a.tipo = com.productoslimpieza.domain.TipoMovimientoApartado.INGRESO
        and a.fecha between :desde and :hasta
      """)
  BigDecimal sumIngresosByCategoriasAndFecha(
      @Param("categorias") List<String> categorias,
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta);
}
