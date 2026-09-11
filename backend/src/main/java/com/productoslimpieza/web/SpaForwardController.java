package com.productoslimpieza.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/** Forward Angular deep links to index.html so refresh/direct URLs do not 404. */
@Controller
public class SpaForwardController {

  @RequestMapping(value = {
      "/login",
      "/ventas", "/entradas", "/inventario", "/uso-casa", "/traspasos",
      "/caja", "/apartados", "/inversion", "/precios", "/lista-precios", "/surtir"
  })
  public String forward() {
    return "forward:/index.html";
  }
}
