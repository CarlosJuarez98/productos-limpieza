package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Traspaso;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TraspasoRepository extends JpaRepository<Traspaso, Long> {

  @Query("""
      select distinct t from Traspaso t
      left join fetch t.persona
      left join fetch t.lineas l
      left join fetch l.producto
      order by t.fecha desc, t.id desc
      """)
  List<Traspaso> findAllWithDetalles();

  @Query("""
      select distinct t from Traspaso t
      left join fetch t.persona
      left join fetch t.lineas l
      left join fetch l.producto
      where t.fecha = :fecha and t.persona.id = :personaId
      order by t.id asc
      """)
  List<Traspaso> findByFechaAndPersonaIdWithDetalles(
      @Param("fecha") LocalDate fecha, @Param("personaId") Long personaId);

  @Query("""
      select distinct t from Traspaso t
      left join fetch t.persona
      left join fetch t.lineas l
      left join fetch l.producto
      where t.id = :id
      """)
  Optional<Traspaso> findWithDetallesById(@Param("id") Long id);

  List<Traspaso> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(t.total), 0) from Traspaso t")
  BigDecimal sumTotal();
}
