package com.productoslimpieza.repo;

import com.productoslimpieza.domain.Persona;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonaRepository extends JpaRepository<Persona, Long> {
  Optional<Persona> findByNombreIgnoreCase(String nombre);

  List<Persona> findAllByOrderByNombreAsc();
}
