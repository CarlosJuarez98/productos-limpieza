package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Receta;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecetaRepository extends JpaRepository<Receta, Long> {
  List<Receta> findAllByOrderByIdAsc();

  Optional<Receta> findByProductoResultadoId(Long productoResultadoId);

  boolean existsByProductoResultadoId(Long productoResultadoId);

  long countByTenantId(String tenantId);
}
