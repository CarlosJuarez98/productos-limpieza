@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PUERTO_WEB=4201"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================
echo  Productos de limpieza - Frontend
echo  Puerto: %PUERTO_WEB%  (no usa 4200)
echo  API esperada: http://localhost:8083/api
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
  ) else (
    echo No se encontro Node.js.
    pause
    exit /b 1
  )
)

if not exist "%~dp0frontend\node_modules\" (
  echo Instalando dependencias del frontend...
  cd /d "%~dp0frontend"
  call npm install
  if errorlevel 1 (
    echo Fallo npm install.
    pause
    exit /b 1
  )
)

echo Liberando puerto %PUERTO_WEB% si esta ocupado...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $pids=@(Get-NetTCPConnection -LocalPort %PUERTO_WEB% -State Listen | Select-Object -ExpandProperty OwningProcess -Unique); foreach($procId in $pids){ if($procId -gt 0){ Stop-Process -Id $procId -Force; Write-Host ('  Cerrado PID ' + $procId) } }; if(-not $pids -or $pids.Count -eq 0){ Write-Host '  Puerto libre.' }"

echo.
echo Abriendo navegador cuando el frontend este listo...
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://localhost:%PUERTO_WEB%/'; for($i=1; $i -le 90; $i++){ try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process $url; exit 0 } } catch {} Start-Sleep -Seconds 2 }; Start-Process $url"

echo Iniciando Angular en http://localhost:%PUERTO_WEB%/
echo Deja esta ventana abierta. Ctrl+C para detener.
echo.

cd /d "%~dp0frontend"
call npx ng serve --port %PUERTO_WEB% --host localhost

pause
