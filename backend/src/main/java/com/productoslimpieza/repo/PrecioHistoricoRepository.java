package com.productoslimpieza.repo;

import com.productoslimpieza.domain.PrecioHistorico;
import com.productoslimpieza.domain.Producto;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrecioHistoricoRepository extends JpaRepository<PrecioHistorico, Long> {

  List<PrecioHistorico> findByProductoOrderByFechaVigenciaDesc(Producto producto);

  List<PrecioHistorico> findAllByOrderByProductoNombreAscFechaVigenciaDesc();

  Optional<PrecioHistorico> findByProductoAndFechaVigencia(Producto producto, LocalDate fechaVigencia);
  @Query("""
      select p from PrecioHistorico p
      where p.producto = :producto and p.fechaVigencia <= :fecha
      order by p.fechaVigencia desc
      """)
  List<PrecioHistorico> findVigentes(@Param("producto") Producto producto, @Param("fecha") LocalDate fecha);

  default Optional<PrecioHistorico> findPrecioVigente(Producto producto, LocalDate fecha) {
    List<PrecioHistorico> list = findVigentes(producto, fecha);
    return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
  }

  void deleteByProducto(Producto producto);
}
