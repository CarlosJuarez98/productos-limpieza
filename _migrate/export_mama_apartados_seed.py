import json
from decimal import Decimal
from pathlib import Path

import oracledb

conn = oracledb.connect(
    user="productos_limpieza",
    password="ProductosLimpieza2026",
    dsn="localhost:1551/XEPDB1",
)
cur = conn.cursor()
cur.execute(
    """
    SELECT fecha, categoria, ingreso, tipo, motivo
    FROM apartados
    WHERE tenant_id = 'mama'
    ORDER BY fecha, id
    """
)
rows = []
for f, cat, ing, tipo, mot in cur:
    rows.append(
        {
            "fecha": f.isoformat() if hasattr(f, "isoformat") else str(f)[:10],
            "categoria": cat,
            "ingreso": float(ing) if isinstance(ing, Decimal) else ing,
            "tipo": tipo,
            "motivo": mot,
        }
    )
out = Path("/out/apartados_mama_export.json")
out.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("n=", len(rows), "last=", rows[-1] if rows else None)
cur.execute(
    "SELECT fecha_inicio, fecha_fin, fondo_inicial FROM caja_config WHERE tenant_id='mama'"
)
print("caja", cur.fetchone())
conn.close()
