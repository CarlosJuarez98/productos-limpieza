#!/bin/bash
set -euo pipefail
echo "=== local homepage ==="
curl -s -o /dev/null -w "home:%{http_code}\n" http://127.0.0.1:8083/
echo "=== APIs ==="
for p in /api/productos /api/ventas /api/entradas /api/apartados /api/caja /api/cortes /api/movimientos-caja /api/precios-historicos /api/producciones /api/inversion; do
  code=$(curl -s -o /tmp/plapi.out -w "%{http_code}" "http://127.0.0.1:8083${p}")
  bytes=$(wc -c </tmp/plapi.out | tr -d ' ')
  head=$(head -c 120 /tmp/plapi.out | tr '\n' ' ')
  echo "$p -> $code bytes=$bytes head=$head"
done