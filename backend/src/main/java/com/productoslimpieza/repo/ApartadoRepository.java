package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Apartado;
import com.productoslimpieza.domain.CategoriaApartado;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApartadoRepository extends JpaRepository<Apartado, Long> {
  List<Apartado> findByCategoriaOrderByFechaDescIdDesc(CategoriaApartado categoria);
  List<Apartado> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(a.ingreso), 0) from Apartado a where a.categoria = :categoria")
  BigDecimal sumByCategoria(@Param("categoria") CategoriaApartado categoria);
}
