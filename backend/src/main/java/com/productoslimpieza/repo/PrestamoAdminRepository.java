package com.productoslimpieza.repo;

import com.productoslimpieza.domain.PrestamoAdmin;
import com.productoslimpieza.domain.TipoPrestamoAdmin;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrestamoAdminRepository extends JpaRepository<PrestamoAdmin, Long> {

  List<PrestamoAdmin> findAllByOrderByFechaDescIdDesc();

  Optional<PrestamoAdmin> findByPedidoAbonoId(Long pedidoAbonoId);

  void deleteByPedidoAbonoId(Long pedidoAbonoId);

  @Query("select coalesce(sum(p.monto), 0) from PrestamoAdmin p where p.tipo = :tipo")
  BigDecimal sumByTipo(@Param("tipo") TipoPrestamoAdmin tipo);
}
