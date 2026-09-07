package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.Traspaso;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TraspasoRepository extends JpaRepository<Traspaso, Long> {

  List<Traspaso> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(t.cantidad), 0) from Traspaso t where t.producto = :producto")
  BigDecimal sumCantidadByProducto(@Param("producto") Producto producto);

  @Query("select coalesce(sum(t.total), 0) from Traspaso t")
  BigDecimal sumTotal();
}
