@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PUERTO_API=8083"
set "JAVA_HOME=A:\Descargas\Desarrollo\sts-4.24.0.RELEASE\plugins\org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_21.0.3.v20240426-1530\jre"
set "MAVEN_HOME=A:\Descargas\Desarrollo\apache-maven-3.9.9"
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME%\bin;%PATH%"

echo ========================================
echo  Productos de limpieza - Backend API
echo  Puerto: %PUERTO_API%  (no usa 8080/8082)
echo  BD propia: db\productos_limpieza
echo ========================================
echo.

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo No se encontro Java en:
  echo   %JAVA_HOME%
  pause
  exit /b 1
)

echo Liberando puerto %PUERTO_API% si esta ocupado...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $pids=@(Get-NetTCPConnection -LocalPort %PUERTO_API% -State Listen | Select-Object -ExpandProperty OwningProcess -Unique); foreach($procId in $pids){ if($procId -gt 0){ Stop-Process -Id $procId -Force; Write-Host ('  Cerrado PID ' + $procId) } }; if(-not $pids -or $pids.Count -eq 0){ Write-Host '  Puerto libre.' }"

echo.
echo Iniciando API en http://localhost:%PUERTO_API%/api
echo Deja esta ventana abierta. Ctrl+C para detener.
echo.

cd /d "%~dp0backend"
mvn -q spring-boot:run

pause
