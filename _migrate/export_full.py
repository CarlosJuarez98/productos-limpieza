import json
import datetime
import os
from decimal import Decimal

try:
    import oracledb
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "oracledb", "-q"])
    import oracledb

DSN = os.environ.get("PL_EXPORT_DSN", "localhost:1551/XEPDB1")
USER = os.environ.get("PL_EXPORT_USER", "productos_limpieza")
PASS = os.environ.get("PL_EXPORT_PASS", "ProductosLimpieza2026")
OUT = os.environ.get("PL_EXPORT_OUT", "/out/full_dump.json")

def conv(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, Decimal):
        if v == v.to_integral_value():
            return int(v)
        return float(v)
    if isinstance(v, bytes):
        return v.hex()
    return v

conn = oracledb.connect(user=USER, password=PASS, dsn=DSN)
cur = conn.cursor()
cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
dump = {"exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "tables": {}}
for t in tables:
    cur.execute(f'SELECT * FROM "{t}"')
    cols = [d[0] for d in cur.description]
    rows = []
    for row in cur:
        rows.append({cols[i]: conv(row[i]) for i in range(len(cols))})
    dump["tables"][t] = {"columns": cols, "rows": rows, "count": len(rows)}
    print(f"{t}: {len(rows)} rows", flush=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(dump, f, ensure_ascii=False, indent=2)
print("WROTE", OUT)
cur.close()
conn.close()
