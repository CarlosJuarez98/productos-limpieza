# Deploy codigo productos-limpieza a OCI (sin sync de datos).
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-nube.ps1

param(
  [string]$SshKey = "A:\Descargas\ssh-key-2026-09-07.key",
  [string]$VmHost = "opc@163.192.146.143",
  [string]$RemoteDir = "~/productos-limpieza"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SshOpts = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")
$tar = Join-Path $env:TEMP "productos-deploy.tar"

Write-Host "== Deploy productos-limpieza (codigo) ==" -ForegroundColor Cyan
Push-Location $Root
tar -cf $tar backend/src frontend/src docker-compose.cloud-atp.yml Dockerfile Caddyfile
Pop-Location
scp @SshOpts $tar "${VmHost}:~/productos-deploy.tar"

$remote = @"
set -e
cd $RemoteDir
tar -xf ~/productos-deploy.tar
rm -f ~/productos-deploy.tar
docker network inspect control-gastos_default >/dev/null 2>&1 || docker network create control-gastos_default
docker network inspect mesa-lista_default >/dev/null 2>&1 || docker network create mesa-lista_default
docker network inspect taximetro_default >/dev/null 2>&1 || docker network create taximetro_default
docker compose -f docker-compose.cloud-atp.yml --env-file .env.cloud up -d --build
docker network connect control-gastos_default productos-limpieza-caddy 2>/dev/null || true
docker network connect mesa-lista_default productos-limpieza-caddy 2>/dev/null || true
docker network connect taximetro_default productos-limpieza-caddy 2>/dev/null || true
for i in 1 2 3 4 5 6 7 8 9 10 12 15; do
  if docker exec productos-limpieza-api wget -qO- http://127.0.0.1:8083/api/health 2>/dev/null | grep -q UP; then
    echo HEALTH_OK
    exit 0
  fi
  sleep 5
done
echo HEALTH_TIMEOUT
exit 1
"@
$remote = ($remote -replace "`r`n", "`n" -replace "`r", "`n")
$remote | ssh @SshOpts $VmHost "bash -s"
if ($LASTEXITCODE -ne 0) { throw "Deploy productos-limpieza fallo (exit $LASTEXITCODE)" }
Write-Host "Listo." -ForegroundColor Green
