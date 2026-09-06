package com.productoslimpieza.repo;

import com.productoslimpieza.domain.InversionItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InversionRepository extends JpaRepository<InversionItem, Long> {
  List<InversionItem> findByTipoOrderByConceptoAsc(String tipo);
  List<InversionItem> findAllByOrderByTipoAscConceptoAsc();
}
