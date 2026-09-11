"""
Sube SOLO tenant mama: Oracle local → ATP.
No borra ni modifica filas de admin.

Uso export (local):
  PL_MODE=export PL_EXPORT_DSN=localhost:1551/XEPDB1 ... python sync_mama_local_to_atp.py

Uso import (VM / ATP):
  PL_MODE=import WALLET_PASSWORD=... CG_USER=... CG_PASS=... CG_DSN=cgatodb_tp python sync_mama_local_to_atp.py
"""
from __future__ import annotations

import datetime
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

import oracledb

TENANT = "mama"
# Evita choque de PK con admin en las mismas tablas
ID_OFFSET = 50_000_000

# Hijos → padres (wipe)
WIPE_ORDER = [
    "AJUSTES_INVENTARIO",
    "PEDIDO_ITEMS",
    "ENTRADAS",
    "PEDIDOS",
    "TRASPASO_ABONOS",
    "TRASPASO_LINEAS",
    "TRASPASOS",
    "PRODUCCIONES",
    "VENTAS",
    "PRECIOS_HISTORICOS",
    "MOVIMIENTOS_CAJA",
    "APARTADOS",
    "INVERSION_ITEMS",
    "CORTES_CAJA",
    "CAJA_CONFIG",
    "MARGEN_CONFIG",
    "APARTADO_RUBROS",
    "PRODUCTOS",
    "PERSONAS",
]

# Columnas numéricas que son PK/FK de identidad (se desplazan)
ID_LIKE = {
    "ID",
    "PRODUCTO_ID",
    "PERSONA_ID",
    "PEDIDO_ID",
    "TRASPASO_ID",
    "PRODUCTO_INSUMO_ID",
    "PRODUCTO_RESULTADO_ID",
}


def conv(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, bytes):
        return v.hex()
    return v


def parse_val(v):
    if v is None:
        return None
    if isinstance(v, str) and len(v) >= 10 and v[4] == "-" and "T" in v:
        try:
            return datetime.datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass
    if isinstance(v, str) and len(v) == 10 and v[4] == "-":
        try:
            return datetime.date.fromisoformat(v)
        except Exception:
            pass
    return v


def connect_local():
    return oracledb.connect(
        user=os.environ.get("PL_EXPORT_USER", "productos_limpieza"),
        password=os.environ.get("PL_EXPORT_PASS", "ProductosLimpieza2026"),
        dsn=os.environ.get("PL_EXPORT_DSN", "localhost:1551/XEPDB1"),
    )


def connect_atp():
    wallet = os.path.expanduser("~/productos-limpieza/wallet")
    return oracledb.connect(
        user=os.environ["CG_USER"],
        password=os.environ["CG_PASS"],
        dsn=os.environ.get("CG_DSN", "cgatodb_tp"),
        config_dir=wallet,
        wallet_location=wallet,
        wallet_password=os.environ["WALLET_PASSWORD"],
    )


def tables_with_tenant(cur) -> set[str]:
    cur.execute(
        "SELECT table_name FROM user_tab_columns WHERE column_name = 'TENANT_ID'"
    )
    return {r[0] for r in cur.fetchall()}


def export_mama(out_path: Path):
    conn = connect_local()
    cur = conn.cursor()
    have = tables_with_tenant(cur)
    dump = {
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tenant": TENANT,
        "id_offset": ID_OFFSET,
        "tables": {},
    }
    for t in WIPE_ORDER:
        if t not in have:
            print(f"skip export {t}")
            continue
        cur.execute(f'SELECT * FROM "{t}" WHERE TENANT_ID = :t', t=TENANT)
        cols = [d[0] for d in cur.description]
        rows = [{cols[i]: conv(row[i]) for i in range(len(cols))} for row in cur]
        dump["tables"][t] = {"columns": cols, "rows": rows, "count": len(rows)}
        print(f"export {t}: {len(rows)}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(dump, ensure_ascii=False), encoding="utf-8")
    print("WROTE", out_path)
    cur.close()
    conn.close()


def offset_row(cols: list[str], row: dict, offset: int) -> dict:
    out = {}
    for c in cols:
        v = row.get(c)
        if c in ID_LIKE and isinstance(v, (int, float)) and v is not None:
            out[c] = int(v) + offset
        else:
            out[c] = parse_val(v)
    if "TENANT_ID" in cols:
        out["TENANT_ID"] = TENANT
    return out


def import_mama(dump_path: Path):
    dump = json.loads(dump_path.read_text(encoding="utf-8"))
    if dump.get("tenant") != TENANT:
        raise SystemExit(f"dump tenant={dump.get('tenant')} expected {TENANT}")
    offset = int(dump.get("id_offset", ID_OFFSET))
    tables = dump["tables"]

    conn = connect_atp()
    cur = conn.cursor()
    have = tables_with_tenant(cur)

    print("=== BEFORE (admin must stay) ===")
    for t in ("PRODUCTOS", "VENTAS", "ENTRADAS", "APARTADOS"):
        if t not in have:
            continue
        cur.execute(
            f"SELECT TENANT_ID, COUNT(*) FROM {t} GROUP BY TENANT_ID ORDER BY 1"
        )
        print(t, cur.fetchall())

    # Identity BY DEFAULT para poder insertar IDs explícitos
    for t in WIPE_ORDER:
        if t not in have or t not in tables:
            continue
        try:
            cur.execute(
                f'ALTER TABLE "{t}" MODIFY ID GENERATED BY DEFAULT AS IDENTITY'
            )
            print("identity default:", t)
        except oracledb.Error as e:
            print("identity skip", t, str(e).splitlines()[0][:120])

    # Wipe solo mama
    for t in WIPE_ORDER:
        if t not in have:
            continue
        cur.execute(f'DELETE FROM "{t}" WHERE TENANT_ID = :t', t=TENANT)
        print(f"wipe mama {t}: {cur.rowcount}")

    # Insert padres → hijos
    for t in reversed(WIPE_ORDER):
        if t not in have or t not in tables:
            continue
        meta = tables[t]
        cols = meta["columns"]
        rows = meta["rows"]
        if not rows:
            print(f"{t}: 0 rows")
            continue
        # Solo columnas que existan en destino
        cur.execute(
            """
            SELECT column_name FROM user_tab_columns
            WHERE table_name = :t
            """,
            t=t,
        )
        dest_cols = {r[0] for r in cur.fetchall()}
        use_cols = [c for c in cols if c in dest_cols]
        placeholders = ", ".join(f":{i+1}" for i in range(len(use_cols)))
        col_sql = ", ".join(f'"{c}"' for c in use_cols)
        sql = f'INSERT INTO "{t}" ({col_sql}) VALUES ({placeholders})'
        n = 0
        for raw in rows:
            mapped = offset_row(cols, raw, offset)
            vals = [mapped.get(c) for c in use_cols]
            try:
                cur.execute(sql, vals)
                n += 1
            except oracledb.Error as e:
                print("FAIL", t, mapped.get("ID"), e)
                conn.rollback()
                raise
        print(f"insert mama {t}: {n}")

    # Ajustar identity al max
    for t in WIPE_ORDER:
        if t not in have:
            continue
        try:
            cur.execute(f'SELECT NVL(MAX(ID),0)+1 FROM "{t}"')
            nxt = int(cur.fetchone()[0])
            cur.execute(
                f'ALTER TABLE "{t}" MODIFY ID GENERATED BY DEFAULT AS IDENTITY (START WITH {nxt})'
            )
            print(f"seq {t} -> {nxt}")
        except oracledb.Error as e:
            print("seq skip", t, str(e).splitlines()[0][:120])

    conn.commit()

    print("=== AFTER ===")
    for t in ("PRODUCTOS", "VENTAS", "ENTRADAS", "APARTADOS", "CORTES_CAJA", "CAJA_CONFIG"):
        if t not in have:
            continue
        cur.execute(
            f"SELECT TENANT_ID, COUNT(*) FROM {t} GROUP BY TENANT_ID ORDER BY 1"
        )
        print(t, cur.fetchall())

    cur.close()
    conn.close()
    print("OK mama sync")


def main():
    mode = os.environ.get("PL_MODE", "export").lower()
    dump = Path(
        os.environ.get(
            "PL_DUMP",
            os.path.expanduser("~/productos-limpieza/_migrate/mama_dump.json"),
        )
    )
    if mode == "export":
        dump = Path(os.environ.get("PL_DUMP", "/out/mama_dump.json"))
        export_mama(dump)
    elif mode == "import":
        if not dump.exists():
            raise SystemExit(f"missing dump {dump}")
        import_mama(dump)
    else:
        raise SystemExit("PL_MODE=export|import")


if __name__ == "__main__":
    main()
