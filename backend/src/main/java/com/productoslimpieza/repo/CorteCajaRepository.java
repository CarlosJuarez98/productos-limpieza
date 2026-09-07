package com.productoslimpieza.repo;

import com.productoslimpieza.domain.CorteCaja;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CorteCajaRepository extends JpaRepository<CorteCaja, Long> {
  boolean existsByFecha(LocalDate fecha);

  Optional<CorteCaja> findByFecha(LocalDate fecha);

  List<CorteCaja> findAllByOrderByFechaAsc();

  @Query("select max(c.fecha) from CorteCaja c")
  Optional<LocalDate> findMaxFecha();
}
