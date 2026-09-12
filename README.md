# Productos de limpieza

Control de ventas, inventario, entradas, caja y apartados.

## Fuente de verdad

**Oracle** (volumen Docker `oracle-productos-limpieza-data`). Todo lo operativo vive en la BD:
productos, histórico de precios (menudeo), ventas, caja, apartados, cortes.

No hay dependencia del Excel. Los JSON en `backend/src/main/resources/data/` son semilla
**opcional** solo si la BD está vacía (`APP_IMPORT_ON_STARTUP=true`).

Stack: **Spring Boot 3** + **Angular 19** + **Oracle XE en Docker**.

## Local primero, nube después

Igual que control-gastos: trabajas en **local**; la nube no se toca hasta que digas **“sube a la nube”**.
Detalle: [`DEPLOY-NUBE.md`](DEPLOY-NUBE.md) · sync de datos: [`SYNC-DATOS.md`](SYNC-DATOS.md).
Nube: https://productos.163.192.146.143.sslip.io/

## Uso diario

Doble clic en `iniciar.bat` (o el acceso directo del escritorio):

| Qué | Puerto | URL |
|-----|--------|-----|
| **Angular (app)** | **4202** | http://127.0.0.1:4202/ |
| API Spring | 8083 | http://127.0.0.1:8083/api |
| Oracle | 1551 | — |

## Base de datos Oracle (Docker)

| Campo | Valor |
|-------|-------|
| Host | `localhost` |
| Puerto | **1551** |
| Service | `XEPDB1` |
| Usuario | `productos_limpieza` |
| Password | `ProductosLimpieza2026` |
| JDBC | `jdbc:oracle:thin:@localhost:1551/XEPDB1` |
| Contenedor | `oracle-productos-limpieza` |
| Volumen | `oracle-productos-limpieza-data` |

## Precios

- **Menudeo / precio actual** = registro vigente en **histórico de precios** (tabla en Oracle).
- Mayoreo ≥5 / ≥10 se guarda en el producto; no lo inventa el Excel.
