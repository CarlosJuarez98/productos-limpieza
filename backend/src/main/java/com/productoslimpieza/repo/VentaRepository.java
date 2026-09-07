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
}
