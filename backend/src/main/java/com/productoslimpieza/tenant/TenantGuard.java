package com.productoslimpieza.tenant;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class TenantGuard {

  private TenantGuard() {}

  public static void assertOwned(TenantEntity entity) {
    if (entity == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    String ctx = TenantContext.require();
    if (entity.getTenantId() == null || !ctx.equals(entity.getTenantId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
  }
}
