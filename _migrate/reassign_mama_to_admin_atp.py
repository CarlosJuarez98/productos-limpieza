"""Inspecciona tenants y reasigna mama→admin en ATP, resolviendo stubs admin."""
import os

import oracledb

user = os.environ["CG_USER"]
password = os.environ["CG_PASS"]
dsn = os.environ.get("CG_DSN", "cgatodb_tp")
wallet = os.path.expanduser("~/productos-limpieza/wallet")
wp = os.environ["WALLET_PASSWORD"]

conn = oracledb.connect(
    user=user,
    password=password,
    dsn=dsn,
    config_dir=wallet,
    wallet_location=wallet,
    wallet_password=wp,
)
cur = conn.cursor()

# Tablas 1 fila por tenant: si hay stub admin y datos mama, borrar stub admin primero.
single_tenant = ("CAJA_CONFIG", "MARGEN_CONFIG")

tables = [
    "PRODUCTOS",
    "PERSONAS",
    "PRECIOS_HISTORICOS",
    "VENTAS",
    "ENTRADAS",
    "PRODUCCIONES",
    "TRASPASOS",
    "TRASPASO_LINEAS",
    "TRASPASO_ABONOS",
    "MOVIMIENTOS_CAJA",
    "APARTADOS",
    "INVERSION_ITEMS",
    "CORTES_CAJA",
    "CAJA_CONFIG",
    "MARGEN_CONFIG",
    "AJUSTES_INVENTARIO",
    "PEDIDOS",
    "PEDIDO_ITEMS",
]

cur.execute(
    "SELECT table_name FROM user_tab_columns WHERE column_name='TENANT_ID'"
)
have = {r[0] for r in cur.fetchall()}

print("=== BEFORE ===")
for t in ("PRODUCTOS", "VENTAS", "ENTRADAS", "CAJA_CONFIG", "MARGEN_CONFIG"):
    if t not in have:
        continue
    cur.execute(f"SELECT TENANT_ID, COUNT(*) FROM {t} GROUP BY TENANT_ID ORDER BY 1")
    print(t, cur.fetchall())

for t in single_tenant:
    if t not in have:
        continue
    cur.execute(
        f"""
        SELECT COUNT(*) FROM {t} WHERE TENANT_ID = 'admin'
        """
    )
    admin_n = cur.fetchone()[0]
    cur.execute(
        f"""
        SELECT COUNT(*) FROM {t} WHERE TENANT_ID = 'mama'
        """
    )
    mama_n = cur.fetchone()[0]
    if admin_n and mama_n:
        cur.execute(f"DELETE FROM {t} WHERE TENANT_ID = 'admin'")
        print(f"deleted admin stub {t}: {cur.rowcount}")

total = 0
for t in tables:
    if t not in have:
        print(f"skip {t}")
        continue
    cur.execute(f"UPDATE {t} SET TENANT_ID = 'admin' WHERE TENANT_ID = 'mama'")
    n = cur.rowcount or 0
    total += n
    print(f"{t}: {n}")

conn.commit()
print(f"TOTAL_UPDATED={total}")

print("=== AFTER ===")
for t in ("PRODUCTOS", "VENTAS", "ENTRADAS", "CAJA_CONFIG", "MARGEN_CONFIG", "CORTES_CAJA", "PERSONAS"):
    if t not in have:
        continue
    cur.execute(f"SELECT TENANT_ID, COUNT(*) FROM {t} GROUP BY TENANT_ID ORDER BY 1")
    rows = cur.fetchall()
    print(t, rows if rows else "(empty)")

cur.close()
conn.close()
print("OK")
