package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
  Optional<Producto> findByNombreIgnoreCase(String nombre);
  List<Producto> findAllByOrderByNombreAsc();
  List<Producto> findByActivoTrueOrderByNombreAsc();
  boolean existsByNombreIgnoreCase(String nombre);

  /** Inversión por stock al dar de alta: cantidadInicial × precioCompra. */
  @Query("""
      select coalesce(sum(p.cantidadInicial * p.precioCompra), 0)
      from Producto p
      where p.cantidadInicial is not null and p.precioCompra is not null
      """)
  BigDecimal sumInversionStockInicial();
}
