# Despliegue en la nube — Productos limpieza

Misma pauta que control-gastos: VM Ampere (ARM) + ATP Always Free.

## Ramas git (local / nube)

Ver **`BRANCHES.md`**.

- Desarrollo diario en la rama **`local`**.
- Deploy a OCI desde la rama **`nube`**.
- Al decir **"sube a la nube"**: merge `local` → `nube`, luego deploy de **código** (sin sync de datos).

## Flujo de trabajo (local primero)

1. Trabajas solo en **local** (`oracle-productos-limpieza` + API/front).
2. La nube **no se toca** hasta que lo pidas.
3. Cuando indiques **“sube a la nube”**: se redespliega **código** si cambió (**sin** datos).
4. Datos solo con **“sube datos”** / **“baja datos”** → `SYNC-DATOS.md`.
5. URL pública HTTPS: `https://productos.163.192.146.143.sslip.io/`  
   (respaldo HTTP: `http://163.192.146.143:8083/`)
6. Certificado: **Caddy + Let’s Encrypt** (renueva solo; puertos **80** y **443** en firewall/NSG).

## Arranque (ATP)

```bash
cd ~/productos-limpieza
docker compose -f docker-compose.cloud-atp.yml --env-file .env.cloud up -d --build
```

En `.env.cloud`:

```bash
SPRING_DATASOURCE_URL=jdbc:oracle:thin:@cgatodb_tp
SPRING_DATASOURCE_USERNAME=productos_limpieza
SPRING_DATASOURCE_PASSWORD=...
APP_CORS_ALLOWED_ORIGINS=https://productos.163.192.146.143.sslip.io,http://163.192.146.143:8083
SERVER_SERVLET_SESSION_COOKIE_SECURE=true
```

Wallet ATP: el mismo de control-gastos en `./wallet` (ruta contenedor `/wallet`).

Puertos host: **8083** (API directa), **80/443** (Caddy HTTPS).

## Sync datos (solo si lo pides)

```powershell
# Subir datos
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
# Bajar datos
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-desde-nube.ps1 -WalletPassword 'WalletPass2798Aa'
```
