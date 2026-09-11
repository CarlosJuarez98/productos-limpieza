package com.productoslimpieza.repo;

import com.productoslimpieza.domain.ApartadoRubro;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApartadoRubroRepository extends JpaRepository<ApartadoRubro, Long> {
  List<ApartadoRubro> findByActivoTrueOrderByOrdenAscIdAsc();

  List<ApartadoRubro> findByActivoTrueAndLiquidaCorteTrueOrderByOrdenAscIdAsc();

  Optional<ApartadoRubro> findByCodigoIgnoreCase(String codigo);

  boolean existsByCodigoIgnoreCase(String codigo);

  long countByTenantId(String tenantId);
}
