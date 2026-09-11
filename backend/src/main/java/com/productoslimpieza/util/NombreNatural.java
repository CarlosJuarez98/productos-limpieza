package com.productoslimpieza.util;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Orden natural: “Atomizador 1/4” &lt; “1/2” &lt; “1L”. */
public final class NombreNatural {

  private static final Pattern TOKEN =
      Pattern.compile("(\\d+)\\s*/\\s*(\\d+)|(\\d+(?:[.,]\\d+)?)|([^\\d]+)");

  private NombreNatural() {}

  public static Comparator<String> comparator() {
    return NombreNatural::compare;
  }

  public static int compare(String a, String b) {
    List<Object> tx = tokens(normalizar(a));
    List<Object> ty = tokens(normalizar(b));
    int n = Math.max(tx.size(), ty.size());
    for (int i = 0; i < n; i++) {
      if (i >= tx.size()) {
        return -1;
      }
      if (i >= ty.size()) {
        return 1;
      }
      Object pa = tx.get(i);
      Object pb = ty.get(i);
      if (pa instanceof Double da && pb instanceof Double db) {
        int c = Double.compare(da, db);
        if (c != 0) {
          return c;
        }
        continue;
      }
      int c = String.valueOf(pa).compareTo(String.valueOf(pb));
      if (c != 0) {
        return c;
      }
    }
    return 0;
  }

  private static String normalizar(String s) {
    if (s == null) {
      return "";
    }
    String t = Normalizer.normalize(s.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
    return t.replaceAll("\\p{M}+", "");
  }

  private static List<Object> tokens(String s) {
    List<Object> out = new ArrayList<>();
    Matcher m = TOKEN.matcher(s);
    while (m.find()) {
      if (m.group(1) != null && m.group(2) != null) {
        double den = Double.parseDouble(m.group(2));
        double num = Double.parseDouble(m.group(1));
        out.add(den == 0 ? num : num / den);
      } else if (m.group(3) != null) {
        out.add(Double.parseDouble(m.group(3).replace(',', '.')));
      } else if (m.group(4) != null) {
        String t = m.group(4).replaceAll("\\s+", " ").trim();
        if (!t.isEmpty()) {
          out.add(t);
        }
      }
    }
    return out;
  }
}
