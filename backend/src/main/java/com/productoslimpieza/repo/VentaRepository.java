package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Producto;
import com.productoslimpieza.domain.TipoVenta;
import com.productoslimpieza.domain.Venta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VentaRepository extends JpaRepository<Venta, Long> {

  List<Venta> findAllByOrderByFechaDescIdDesc();

  List<Venta> findByTipoVentaOrderByFechaDescIdDesc(TipoVenta tipoVenta);

  List<Venta> findByFechaBetweenOrderByFechaDescIdDesc(LocalDate desde, LocalDate hasta);

  @Query("""
      select coalesce(sum(v.cantidad), 0) from Venta v
      where v.producto = :producto and v.tipoVenta in :tipos
      """)
  BigDecimal sumCantidadByProductoAndTipos(
      @Param("producto") Producto producto,
      @Param("tipos") List<TipoVenta> tipos);

  @Query("""
      select coalesce(sum(v.cantidad), 0) from Venta v
      where v.producto = :producto and v.tipoVenta = :tipo
      """)
  BigDecimal sumCantidadByProductoAndTipo(
      @Param("producto") Producto producto,
      @Param("tipo") TipoVenta tipo);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.fecha between :desde and :hasta and v.tipoVenta in :tipos
      """)
  BigDecimal sumTotalByFechaAndTipos(
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta,
      @Param("tipos") List<TipoVenta> tipos);

  long countByProducto(Producto producto);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.tipoVenta not in :excluidos
      """)
  BigDecimal sumTotalExcludingTipos(@Param("excluidos") List<TipoVenta> excluidos);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.tipoVenta in :tipos
      """)
  BigDecimal sumTotalByTipos(@Param("tipos") List<TipoVenta> tipos);

  /** Costo = cantidad × precioCompra (Litros/Pieza/Mayoreo/etc.). */
  @Query("""
      select coalesce(sum(v.cantidad * coalesce(p.precioCompra, 0)), 0)
      from Venta v join v.producto p
      where v.tipoVenta in :tipos
      """)
  BigDecimal sumCostoUnidadesByTipos(@Param("tipos") List<TipoVenta> tipos);

  @Query("""
      select v from Venta v join fetch v.producto
      where v.tipoVenta = :tipo
      """)
  List<Venta> findByTipoConProducto(@Param("tipo") TipoVenta tipo);
}
