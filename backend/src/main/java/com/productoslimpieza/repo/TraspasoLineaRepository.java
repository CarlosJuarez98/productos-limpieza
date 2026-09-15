package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TraspasoLinea;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TraspasoLineaRepository extends JpaRepository<TraspasoLinea, Long> {

  @Query("select coalesce(sum(l.cantidad), 0) from TraspasoLinea l where l.producto = :producto")
  BigDecimal sumCantidadByProducto(@Param("producto") Producto producto);

  @Query("select l.producto.id, coalesce(sum(l.cantidad), 0) from TraspasoLinea l group by l.producto.id")
  List<Object[]> sumCantidadGroupByProducto();

  @Query("""
      select coalesce(sum(l.cantidad), 0) from TraspasoLinea l
      where l.producto = :producto
      and l.traspaso.fecha between :desde and :hasta
      """)
  BigDecimal sumCantidadByProductoAndFecha(
      @Param("producto") Producto producto,
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta);

  long countByProducto(Producto producto);
}
