package com.productoslimpieza.web;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LoginNormalizeTest {

  @Test
  void normalizeUserStripsAccentsAndLowercases() {
    assertEquals("mama", AuthController.normalizeUser("Mamá"));
    assertEquals("admin", AuthController.normalizeUser("  ADMIN "));
  }

  @Test
  void displayNameForKnownUsers() {
    assertEquals("Mamá", AuthController.displayName("mama"));
    assertEquals("Admin", AuthController.displayName("admin"));
  }
}
