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
      select v.producto.id, coalesce(sum(v.cantidad), 0) from Venta v
      where v.tipoVenta in :tipos
      group by v.producto.id
      """)
  List<Object[]> sumCantidadGroupByProductoAndTipos(@Param("tipos") List<TipoVenta> tipos);

  @Query("""
      select coalesce(sum(v.cantidad), 0) from Venta v
      where v.producto = :producto and v.tipoVenta = :tipo
      """)
  BigDecimal sumCantidadByProductoAndTipo(
      @Param("producto") Producto producto,
      @Param("tipo") TipoVenta tipo);

  @Query("""
      select v.producto.id, coalesce(sum(v.cantidad), 0) from Venta v
      where v.tipoVenta = :tipo
      group by v.producto.id
      """)
  List<Object[]> sumCantidadGroupByProductoAndTipo(@Param("tipo") TipoVenta tipo);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.fecha between :desde and :hasta and v.tipoVenta in :tipos
      """)
  BigDecimal sumTotalByFechaAndTipos(
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta,
      @Param("tipos") List<TipoVenta> tipos);

  @Query("""
      select coalesce(sum(v.cantidad), 0) from Venta v
      where v.producto = :producto and v.tipoVenta in :tipos
      and v.fecha between :desde and :hasta
      """)
  BigDecimal sumCantidadByProductoTiposAndFecha(
      @Param("producto") Producto producto,
      @Param("tipos") List<TipoVenta> tipos,
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta);

  @Query("""
      select coalesce(sum(v.cantidad), 0) from Venta v
      where v.producto = :producto and v.tipoVenta = :tipo
      and v.fecha between :desde and :hasta
      """)
  BigDecimal sumCantidadByProductoTipoAndFecha(
      @Param("producto") Producto producto,
      @Param("tipo") TipoVenta tipo,
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.fecha between :desde and :hasta and v.tipoVenta in :tipos
      and v.pagoTarjeta = :tarjeta
      """)
  BigDecimal sumTotalByFechaAndTiposAndPagoTarjeta(
      @Param("desde") LocalDate desde,
      @Param("hasta") LocalDate hasta,
      @Param("tipos") List<TipoVenta> tipos,
      @Param("tarjeta") boolean tarjeta);

  @Query("""
      select coalesce(sum(v.total), 0) from Venta v
      where v.tipoVenta in :tipos and v.pagoTarjeta = true
      """)
  BigDecimal sumTotalTarjetaByTipos(@Param("tipos") List<TipoVenta> tipos);

  List<Venta> findByFolioAndFechaOrderByIdAsc(Long folio, LocalDate fecha);

  List<Venta> findByFolioIsNullOrderByFechaAscIdAsc();

  /** Max folio del día (por tenant). Empieza en 1 cada fecha. */
  @Query("""
      select coalesce(max(v.folio), 0) from Venta v
      where v.tenantId = :tenantId and v.fecha = :fecha
      """)
  Long maxFolioDelDia(@Param("tenantId") String tenantId, @Param("fecha") LocalDate fecha);

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
