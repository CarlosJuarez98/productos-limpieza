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

  @Query(
      "select p.productoResultado.id, coalesce(sum(p.cantidadResultado), 0) from Produccion p group by p.productoResultado.id")
  List<Object[]> sumResultadoGroupByProducto();

  @Query("select coalesce(sum(i.cantidad), 0) from ProduccionInsumo i where i.producto = :producto")
  BigDecimal sumInsumoLineasByProducto(@Param("producto") Producto producto);

  @Query(
      "select i.producto.id, coalesce(sum(i.cantidad), 0) from ProduccionInsumo i group by i.producto.id")
  List<Object[]> sumInsumoLineasGroupByProducto();

  @Query(
      """
      select coalesce(sum(p.cantidadInsumo), 0) from Produccion p
      where p.productoInsumo = :producto and p.insumos is empty
      """)
  BigDecimal sumInsumoLegacyByProducto(@Param("producto") Producto producto);

  @Query(
      """
      select p.productoInsumo.id, coalesce(sum(p.cantidadInsumo), 0) from Produccion p
      where p.productoInsumo is not null and p.insumos is empty
      group by p.productoInsumo.id
      """)
  List<Object[]> sumInsumoLegacyGroupByProducto();

  long countByProductoResultado(Producto productoResultado);

  @Query(
      """
      select count(p) from Produccion p
      where p.productoInsumo = :producto
         or exists (select 1 from ProduccionInsumo i where i.produccion = p and i.producto = :producto)
      """)
  long countByProductoInsumo(@Param("producto") Producto producto);
}
