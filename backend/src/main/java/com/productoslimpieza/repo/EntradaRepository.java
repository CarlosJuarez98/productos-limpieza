package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Entrada;
import com.productoslimpieza.domain.Pedido;
import com.productoslimpieza.domain.Producto;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EntradaRepository extends JpaRepository<Entrada, Long> {
  List<Entrada> findAllByOrderByFechaDescIdDesc();

  @Query("select coalesce(sum(e.cantidad), 0) from Entrada e where e.producto = :producto")
  BigDecimal sumCantidadByProducto(@Param("producto") Producto producto);

  @Query("select coalesce(sum(e.total), 0) from Entrada e")
  BigDecimal sumTotal();

  long countByProducto(Producto producto);

  @Query(
      "select coalesce(sum(e.cantidad), 0) from Entrada e where e.pedido = :pedido and e.producto = :producto")
  BigDecimal sumCantidadByPedidoAndProducto(
      @Param("pedido") Pedido pedido, @Param("producto") Producto producto);

  List<Entrada> findByPedidoId(Long pedidoId);

  java.util.Optional<Entrada> findFirstByProductoIdAndPrecioProveedorIsNotNullOrderByFechaDescIdDesc(
      Long productoId);

  java.util.Optional<Entrada>
      findFirstByProductoIdAndIdNotAndPrecioProveedorIsNotNullOrderByFechaDescIdDesc(
          Long productoId, Long id);
}
