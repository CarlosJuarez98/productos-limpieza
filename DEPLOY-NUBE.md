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
   El puerto **8083** ya no es público (solo `127.0.0.1` en la VM). No uses `http://IP:8083`.
6. Certificado: **Caddy + Let’s Encrypt** (renueva solo; puertos **80** y **443** en firewall/NSG).
   - Si el certificado no sale (“Timeout during connect”), abre 80/443 en el NSG de OCI.
   - En Cloud Shell: `bash scripts/open-80-443-cloudshell.sh`
   - Tras abrir puertos, reinicia Caddy: `docker restart productos-limpieza-caddy`

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
APP_CORS_ALLOWED_ORIGINS=https://productos.163.192.146.143.sslip.io
SERVER_SERVLET_SESSION_COOKIE_SECURE=true
```

Wallet ATP: el mismo de control-gastos en `./wallet` (ruta contenedor `/wallet`).

Puertos host: **80/443** (Caddy HTTPS). API interna en `127.0.0.1:8083` (no pública).

## Sync datos (solo si lo pides)

```powershell
# Subir datos
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
# Bajar datos
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-desde-nube.ps1 -WalletPassword 'WalletPass2798Aa'
```
