package com.productoslimpieza.repo;

import com.productoslimpieza.domain.EstadoPedidoDomicilio;
import com.productoslimpieza.domain.PedidoDomicilio;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PedidoDomicilioRepository extends JpaRepository<PedidoDomicilio, Long> {
  List<PedidoDomicilio> findAllByOrderByFechaDescIdDesc();

  List<PedidoDomicilio> findByEstadoOrderByFechaDescIdDesc(EstadoPedidoDomicilio estado);
}
