package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Traspaso;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TraspasoRepository extends JpaRepository<Traspaso, Long> {

  @Query("""
      select distinct t from Traspaso t
      left join fetch t.persona
      left join fetch t.lineas l
      left join fetch l.producto
      order by t.fecha desc, t.id desc
      """)
  List<Traspaso> findAllWithDetalles();

  List<Traspaso> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(t.total), 0) from Traspaso t")
  BigDecimal sumTotal();
}
