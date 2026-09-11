package com.productoslimpieza.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.hibernate.Session;
import org.springframework.stereotype.Component;

/** Activa el filtro Hibernate tenant_id en cada llamada a servicio o API. */
@Aspect
@Component
public class TenantHibernateFilterAspect {

  @PersistenceContext
  private EntityManager entityManager;

  @Before(
      "@within(org.springframework.stereotype.Service) || "
          + "@within(org.springframework.web.bind.annotation.RestController)")
  public void enableTenantFilter() {
    String tenant = TenantContext.get();
    if (tenant == null || tenant.isBlank()) return;
    try {
      Session session = entityManager.unwrap(Session.class);
      var filter = session.getEnabledFilter(TenantEntity.FILTER);
      if (filter == null) {
        session.enableFilter(TenantEntity.FILTER).setParameter("tenantId", tenant);
      } else {
        filter.setParameter("tenantId", tenant);
      }
    } catch (Exception ignored) {
      // sin sesión JPA en este hilo
    }
  }
}
