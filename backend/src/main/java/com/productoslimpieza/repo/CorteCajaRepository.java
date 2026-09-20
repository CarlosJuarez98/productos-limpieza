package com.productoslimpieza.repo;

import com.productoslimpieza.domain.CorteCaja;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CorteCajaRepository extends JpaRepository<CorteCaja, Long> {
  boolean existsByFecha(LocalDate fecha);

  Optional<CorteCaja> findByFecha(LocalDate fecha);

  List<CorteCaja> findAllByOrderByFechaAsc();

  /** Max fecha del tenant actual. El filtro Hibernate a veces no aplica en agregados JPQL. */
  @Query("select max(c.fecha) from CorteCaja c where c.tenantId = :tenantId")
  Optional<LocalDate> findMaxFecha(@Param("tenantId") String tenantId);
}
