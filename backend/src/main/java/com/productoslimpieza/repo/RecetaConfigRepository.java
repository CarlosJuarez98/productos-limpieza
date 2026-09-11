package com.productoslimpieza.repo;

import com.productoslimpieza.domain.RecetaConfig;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RecetaConfigRepository extends JpaRepository<RecetaConfig, Long> {
  Optional<RecetaConfig> findByTenantId(String tenantId);

  @Query(value = "select nvl(max(id), 0) + 1 from receta_config", nativeQuery = true)
  Long nextId();
}
