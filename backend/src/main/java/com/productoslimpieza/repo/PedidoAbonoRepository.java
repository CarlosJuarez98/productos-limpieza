package com.productoslimpieza.repo;

import com.productoslimpieza.domain.PedidoAbono;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PedidoAbonoRepository extends JpaRepository<PedidoAbono, Long> {

  List<PedidoAbono> findByPedidoIdOrderByFechaDescIdDesc(Long pedidoId);

  @Query("select coalesce(sum(a.monto), 0) from PedidoAbono a where a.pedido.id = :pedidoId")
  BigDecimal sumMontoByPedidoId(@Param("pedidoId") Long pedidoId);
}
