package com.productoslimpieza.repo;

import com.productoslimpieza.domain.CajaConfig;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CajaConfigRepository extends JpaRepository<CajaConfig, Long> {
  Optional<CajaConfig> findByTenantId(String tenantId);

  @Query(value = "select nvl(max(id), 0) + 1 from caja_config", nativeQuery = true)
  Long nextId();
}
