#!/usr/bin/env python3
import os, re, shutil, tempfile
import oracledb

HOME = os.path.expanduser("~")
WALLET_SRC = os.path.join(HOME, "control-gastos", "wallet")

def prepare_wallet():
    tmp = tempfile.mkdtemp(prefix="pl_wallet_")
    for name in os.listdir(WALLET_SRC):
        src = os.path.join(WALLET_SRC, name)
        if not os.path.isfile(src):
            continue
        if name.lower().endswith(".pem"):
            print("Skipping PEM:", name)
            continue
        shutil.copy2(src, os.path.join(tmp, name))
    sqlnet = os.path.join(tmp, "sqlnet.ora")
    if os.path.exists(sqlnet):
        text = open(sqlnet, "r", encoding="utf-8").read()
        text = re.sub(r'DIRECTORY\s*=\s*"[^"]*"', f'DIRECTORY="{tmp}"', text, flags=re.IGNORECASE)
        open(sqlnet, "w", encoding="utf-8").write(text)
        print("sqlnet fixed to", tmp)
    return tmp

wallet = prepare_wallet()
try:
    os.environ["TNS_ADMIN"] = wallet
    conn = oracledb.connect(user="ADMIN", password="CaAnJuRo2798Atp#", dsn="cgatodb_tp", config_dir=wallet, wallet_location=wallet)
    cur = conn.cursor()
    cur.execute("""
BEGIN
  EXECUTE IMMEDIATE 'CREATE USER productos_limpieza IDENTIFIED BY "PlApp#2798Cloud!"';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1920 THEN RAISE; END IF;
END;
""")
    print("CREATE USER: ok")
    for stmt in ["GRANT CONNECT TO productos_limpieza", "GRANT RESOURCE TO productos_limpieza", "GRANT UNLIMITED TABLESPACE TO productos_limpieza"]:
        cur.execute(stmt)
        print(stmt, ": ok")
    conn.commit()
    cur.close()
    conn.close()
    print("DONE")
finally:
    shutil.rmtree(wallet, ignore_errors=True)
