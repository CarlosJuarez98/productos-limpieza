<#
.SYNOPSIS
  Exporta TODA la data local (Oracle Docker) y la sube a ATP en la VM OCI.

.DESCRIPTION
  1) Exporta tablas USER a _migrate/full_dump.json (via docker python+oracledb a localhost:1551)
  2) SCP dump + ImportPlJson a la VM
  3) Import JDBC contra ATP (wallet en ~/productos-limpieza/wallet)

.PARAMETER SshKey
  Ruta a la llave SSH (default: A:\Descargas\ssh-key-2026-09-07.key)

.PARAMETER VmHost
  Host de la VM (default: opc@163.192.146.143)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
#>
[CmdletBinding()]
param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$SshKey = "A:\Descargas\ssh-key-2026-09-07.key",
  [string]$VmHost = "opc@163.192.146.143",
  [string]$OracleContainer = "oracle-productos-limpieza",
  [string]$LocalUser = "productos_limpieza",
  [string]$LocalPass = "ProductosLimpieza2026",
  [string]$LocalDsn = "localhost:1551/XEPDB1"
)

$ErrorActionPreference = "Stop"
$Migrate = Join-Path $ProjectRoot "_migrate"
New-Item -ItemType Directory -Force -Path $Migrate | Out-Null
$Dump = Join-Path $Migrate "full_dump.json"
$ExportPy = Join-Path $Migrate "export_full.py"
$ImportJava = Join-Path $Migrate "ImportPlJson.java"
$RunImport = Join-Path $Migrate "run_import_pl.sh"

function Assert-File([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Missing required file: $Path" }
}

Write-Host "==> Checking local Oracle container $OracleContainer"
docker inspect -f "{{.State.Health.Status}}" $OracleContainer | Out-Host
Assert-File $ExportPy
Assert-File $ImportJava
Assert-File $RunImport
Assert-File $SshKey

Write-Host "==> Exporting local Oracle -> $Dump"
docker run --rm --network host `
  -v "${Migrate}:/out" `
  -v "${ExportPy}:/export_full.py:ro" `
  -e "PL_EXPORT_USER=$LocalUser" `
  -e "PL_EXPORT_PASS=$LocalPass" `
  -e "PL_EXPORT_DSN=$LocalDsn" `
  python:3.12-slim `
  bash -c "pip install -q oracledb && python /export_full.py"

Assert-File $Dump
Get-Item $Dump | Format-List Name,Length,LastWriteTime

$sshBase = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")

Write-Host "==> Ensuring remote _migrate and uploading dump/scripts"
& ssh @sshBase $VmHost "mkdir -p ~/productos-limpieza/_migrate"
& scp @sshBase $Dump "${VmHost}:~/productos-limpieza/_migrate/full_dump.json"
& scp @sshBase $ImportJava "${VmHost}:~/productos-limpieza/_migrate/ImportPlJson.java"
& scp @sshBase $RunImport "${VmHost}:~/productos-limpieza/_migrate/run_import_pl.sh"
& ssh @sshBase $VmHost "sed -i 's/\r$//' ~/productos-limpieza/_migrate/run_import_pl.sh && chmod +x ~/productos-limpieza/_migrate/run_import_pl.sh"

Write-Host "==> Importing into ATP (JDBC via productos-limpieza-api jars)"
& ssh @sshBase $VmHost "bash ~/productos-limpieza/_migrate/run_import_pl.sh ~/productos-limpieza/_migrate/full_dump.json"

Write-Host "==> Smoke checks on VM"
& ssh @sshBase $VmHost "curl -s -o /dev/null -w 'home:%{http_code}\n' http://127.0.0.1:8083/; curl -s http://127.0.0.1:8083/api/inventario | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"inventario\", len(d) if isinstance(d,list) else d)'; curl -s -o /dev/null -w 'ventas:%{http_code}\n' http://127.0.0.1:8083/api/ventas"

Write-Host @"

Sync complete.
Public URL (requires NSG 8083): http://163.192.146.143:8083/
If external timeout: run scripts/open-8083-cloudshell.sh in OCI Cloud Shell.
"@