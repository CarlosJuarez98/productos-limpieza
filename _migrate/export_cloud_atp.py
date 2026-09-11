import oracledb, os, json, datetime
from decimal import Decimal

wallet = os.path.expanduser("~/productos-limpieza/wallet")
wp = os.environ["WALLET_PASSWORD"]
user = os.environ["CG_USER"]
password = os.environ["CG_PASS"]
dsn = os.environ.get("CG_DSN", "cgatodb_tp")
out = os.path.expanduser("~/productos-limpieza/_migrate/cloud_dump.json")
os.makedirs(os.path.dirname(out), exist_ok=True)

def conv(v):
    if v is None: return None
    if isinstance(v, (datetime.datetime, datetime.date)): return v.isoformat()
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, bytes): return v.hex()
    return v

conn = oracledb.connect(user=user, password=password, dsn=dsn,
                        config_dir=wallet, wallet_location=wallet, wallet_password=wp)
cur = conn.cursor()
cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
dump = {"exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "tables": {}}
for t in tables:
    cur.execute(f'SELECT * FROM "{t}"')
    cols = [d[0] for d in cur.description]
    rows = [{cols[i]: conv(row[i]) for i in range(len(cols))} for row in cur]
    dump["tables"][t] = {"columns": cols, "rows": rows, "count": len(rows)}
    print(f"{t}: {len(rows)}", flush=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(dump, f, ensure_ascii=False)
print("WROTE", out)
conn.close()
