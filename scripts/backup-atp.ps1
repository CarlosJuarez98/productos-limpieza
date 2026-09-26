# Backup ATP → JSON en la VM y descarga local (_backups/).
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup-atp.ps1 -WalletPassword 'WalletPass2798Aa'

param(
  [string]$SshKey = "A:\Descargas\ssh-key-2026-09-07.key",
  [string]$VmHost = "opc@163.192.146.143",
  [string]$WalletPassword = "",
  [string]$CloudUser = "productos_limpieza",
  [string]$CloudDsn = "cgatodb_tp"
)

$ErrorActionPreference = "Stop"
if (-not $WalletPassword) { throw "Pasa -WalletPassword" }
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LocalBackups = Join-Path $Root "_backups"
New-Item -ItemType Directory -Force -Path $LocalBackups | Out-Null
$SshOpts = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$CloudPass = (ssh @SshOpts $VmHost "grep '^SPRING_DATASOURCE_PASSWORD=' ~/productos-limpieza/.env.cloud | cut -d= -f2-").Trim()

$py = @'
import oracledb, os, json, datetime
from decimal import Decimal
wallet=os.path.expanduser("~/productos-limpieza/wallet")
out=os.path.expanduser(f"~/productos-limpieza/_backups/{os.environ['STAMP']}.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
def conv(v):
  if v is None: return None
  if isinstance(v,(datetime.datetime,datetime.date)): return v.isoformat()
  if isinstance(v,Decimal): return int(v) if v==v.to_integral_value() else float(v)
  return v
conn=oracledb.connect(user=os.environ["PL_USER"], password=os.environ["PL_PASS"], dsn=os.environ.get("PL_DSN","cgatodb_tp"),
  config_dir=wallet, wallet_location=wallet, wallet_password=os.environ["WALLET_PASSWORD"])
cur=conn.cursor(); cur.execute("SELECT table_name FROM user_tables ORDER BY 1")
dump={"app":"productos-limpieza","exported_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"tables":{}}
for (t,) in cur.fetchall():
  cur.execute(f'SELECT * FROM "{t}"')
  cols=[d[0] for d in cur.description]
  rows=[{cols[i]:conv(r[i]) for i in range(len(cols))} for r in cur]
  dump["tables"][t]={"columns":cols,"rows":rows,"count":len(rows)}
  print(t, len(rows), flush=True)
json.dump(dump, open(out,"w",encoding="utf-8"), ensure_ascii=False)
print("WROTE", out)
conn.close()
'@
$pyPath = Join-Path $env:TEMP "pl_backup_atp.py"
Set-Content $pyPath $py -Encoding UTF8
scp @SshOpts $pyPath "${VmHost}:/tmp/pl_backup_atp.py"
ssh @SshOpts $VmHost "mkdir -p ~/productos-limpieza/_backups && STAMP='$stamp' WALLET_PASSWORD='$WalletPassword' PL_USER='$CloudUser' PL_PASS='$CloudPass' PL_DSN='$CloudDsn' python3 /tmp/pl_backup_atp.py"
scp @SshOpts "${VmHost}:~/productos-limpieza/_backups/$stamp.json" (Join-Path $LocalBackups "$stamp.json")
Write-Host "Backup en $LocalBackups\$stamp.json" -ForegroundColor Green
