@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  Productos de limpieza - Inicio completo
echo ========================================
echo.
echo  Backend API : http://localhost:8083/api
echo  Frontend    : http://localhost:4201/
echo.
echo  Puertos elegidos para NO chocar con:
echo   - 8080 / 4200  (otros proyectos)
echo   - 8082         (si quedo algo anterior)
echo.

echo [1/2] Abriendo backend...
start "Productos Limpieza - Backend" cmd /k "%~dp0iniciar-backend.bat"

echo Esperando a que el API responda...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=1; $i -le 60; $i++){ try { $r=Invoke-WebRequest -Uri 'http://localhost:8083/api/inventario' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Write-Host ('  API lista (' + $i + 's)'); $ok=$true; break } } catch {} Start-Sleep -Seconds 2 }; if(-not $ok){ Write-Host '  AVISO: el API aun no responde; igual se abre el frontend.' }"

echo.
echo [2/2] Abriendo frontend...
start "Productos Limpieza - Frontend" cmd /k "%~dp0iniciar-frontend.bat"

echo.
echo Listo. Quedaron 2 ventanas abiertas (backend y frontend).
echo Cierralas o usa Ctrl+C en cada una para detener.
echo.
pause
