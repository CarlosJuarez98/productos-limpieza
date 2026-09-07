@echo off
REM Modo empaquetado: Angular dentro del JAR en :8083 (como Docker all-in-one).
REM Para uso diario con Angular en :4202, usa iniciar.bat o dev.bat.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PUERTO=8083"
set "URL=http://localhost:%PUERTO%/"
set "CONTENEDOR=productos-limpieza-api"
set "DOCKER_BIN=C:\Program Files\Docker\Docker\resources\bin"
if exist "%DOCKER_BIN%\docker.exe" set "PATH=%DOCKER_BIN%;%PATH%"

echo ========================================
echo  Productos de limpieza - Docker all-in-one
echo  App embebida en :8083 (sin ng serve)
echo ========================================
echo.
echo  Preferible para dia a dia: iniciar.bat -^> http://127.0.0.1:4202/
echo  Este modo: %URL%
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Falta Docker Desktop. Instalalo y vuelve a intentar.
  pause
  exit /b 1
)

echo [1/4] Docker Desktop...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=1;$i -le 60;$i++){ docker info 1>$null 2>$null; if($LASTEXITCODE -eq 0){ Write-Host '  OK'; exit 0 }; Start-Sleep 3 }; exit 1"
if errorlevel 1 (
  echo Docker Desktop no esta listo. Abrelo y vuelve a ejecutar.
  pause
  exit /b 1
)

echo [2/4] Liberando puerto %PUERTO% si lo usa un Java/Node local...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; foreach($c in @(Get-NetTCPConnection -LocalPort %PUERTO% -State Listen)){ $p=Get-Process -Id $c.OwningProcess -EA SilentlyContinue; if($p -and $p.ProcessName -match 'java|node'){ Write-Host ('  Cerrando ' + $p.ProcessName + ' PID ' + $p.Id); Stop-Process -Id $p.Id -Force } }"

echo [3/4] Construyendo e iniciando Oracle + API (incluye front embebido)...
docker compose up -d --build
if errorlevel 1 (
  echo Fallo docker compose up --build. Revisa Docker Desktop.
  pause
  exit /b 1
)

echo [4/4] Esperando a que la app responda y abriendo el navegador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%URL%'; for($i=1;$i -le 90;$i++){ try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){ Start-Process $url; Write-Host '  Listo.'; exit 0 } } catch {}; Start-Sleep 2 }; Start-Process $url; Write-Host '  Se abrio el navegador (la app pudo seguir arrancando).'"

echo.
echo Contenedores:
docker compose ps
echo.
echo Logs: docker logs -f %CONTENEDOR%
echo Detener: docker compose stop
echo.
pause
