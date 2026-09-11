package com.productoslimpieza.repo;

import com.productoslimpieza.domain.AjusteInventario;
import com.productoslimpieza.domain.Producto;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AjusteInventarioRepository extends JpaRepository<AjusteInventario, Long> {
  List<AjusteInventario> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(a.cantidad), 0) from AjusteInventario a where a.producto = :producto")
  BigDecimal sumCantidadByProducto(@Param("producto") Producto producto);

  long countByProducto(Producto producto);
}
