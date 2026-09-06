package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
  Optional<Producto> findByNombreIgnoreCase(String nombre);
  List<Producto> findAllByOrderByNombreAsc();
  boolean existsByNombreIgnoreCase(String nombre);
}
