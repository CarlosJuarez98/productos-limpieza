package com.productoslimpieza.repo;

import com.productoslimpieza.domain.MargenConfig;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MargenConfigRepository extends JpaRepository<MargenConfig, Long> {
  Optional<MargenConfig> findByTenantId(String tenantId);

  @Query(value = "select nvl(max(id), 0) + 1 from margen_config", nativeQuery = true)
  Long nextId();
}
