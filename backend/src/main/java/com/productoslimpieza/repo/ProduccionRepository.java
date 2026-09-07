package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Produccion;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProduccionRepository extends JpaRepository<Produccion, Long> {

  List<Produccion> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(p.cantidadResultado), 0) from Produccion p where p.productoResultado = :producto")
  BigDecimal sumResultadoByProducto(@Param("producto") Producto producto);

  @Query("select coalesce(sum(p.cantidadInsumo), 0) from Produccion p where p.productoInsumo = :producto")
  BigDecimal sumInsumoByProducto(@Param("producto") Producto producto);
}
