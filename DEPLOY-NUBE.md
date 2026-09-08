# Despliegue en la nube — Productos limpieza

Misma pauta que control-gastos: VM Ampere (ARM) + ATP Always Free.

## Ramas git (local / 
ube)

Ver **`BRANCHES.md`**.

- Desarrollo diario en la rama **`local`**.
- Deploy a OCI desde la rama **`nube`**.
- Al decir **"sube a la nube"**: merge `local` → `nube`, luego deploy/sync desde `nube`.

## Flujo de trabajo (local primero)

1. Trabajas solo en **local** (`oracle-productos-limpieza` + API/front).
2. La nube **no se toca** hasta que lo pidas.
3. Cuando indiques **“sube a la nube”**:
   - se redespliega **código** si cambió
   - se sincronizan **datos** (ver `SYNC-DATOS.md`)
4. URL pública: `http://163.192.146.143:8083/`

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
APP_CORS_ALLOWED_ORIGINS=http://163.192.146.143:8083
```

Wallet ATP: el mismo de control-gastos en `./wallet` (ruta contenedor `/wallet`).

Puerto host: **8083** (firewall VM + NSG OCI).

## Sync datos

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
```
