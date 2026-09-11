package com.productoslimpieza.repo;

import com.productoslimpieza.domain.PedidoItem;
import com.productoslimpieza.domain.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PedidoItemRepository extends JpaRepository<PedidoItem, Long> {
  long countByProducto(Producto producto);
}
