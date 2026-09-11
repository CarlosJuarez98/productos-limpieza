package com.productoslimpieza.repo;

import com.productoslimpieza.domain.EstadoPedido;
import com.productoslimpieza.domain.Pedido;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PedidoRepository extends JpaRepository<Pedido, Long> {
  List<Pedido> findAllByOrderByFechaDescIdDesc();

  List<Pedido> findByEstadoInOrderByFechaAscIdAsc(Collection<EstadoPedido> estados);

  @Query("select distinct p from Pedido p left join fetch p.items i left join fetch i.producto where p.id = :id")
  java.util.Optional<Pedido> findByIdWithItems(@Param("id") Long id);
}
