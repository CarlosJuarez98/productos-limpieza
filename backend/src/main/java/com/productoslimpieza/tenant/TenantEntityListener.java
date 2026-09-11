package com.productoslimpieza.tenant;

import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

public class TenantEntityListener {

  @PrePersist
  public void prePersist(Object entity) {
    if (!(entity instanceof TenantEntity te)) return;
    if (te.getTenantId() == null || te.getTenantId().isBlank()) {
      te.setTenantId(TenantContext.require());
    }
  }

  @PreUpdate
  public void preUpdate(Object entity) {
    if (!(entity instanceof TenantEntity te)) return;
    String ctx = TenantContext.get();
    if (ctx != null && te.getTenantId() != null && !ctx.equals(te.getTenantId())) {
      throw new IllegalStateException("No se puede modificar un registro de otro usuario");
    }
    if (te.getTenantId() == null || te.getTenantId().isBlank()) {
      te.setTenantId(TenantContext.require());
    }
  }
}
