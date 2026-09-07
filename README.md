# Productos de limpieza

Control de ventas, inventario, entradas, caja y apartados.

La **fuente de verdad es Oracle** (volumen Docker). El Excel ya no se usa.

Stack: **Spring Boot 3** + **Angular 19** + **Oracle XE en Docker**.

## Uso diario (como los otros proyectos)

Doble clic en `iniciar.bat` (o `dev.bat`):

| Qué | Puerto | URL |
|-----|--------|-----|
| **Angular (app)** | **4202** | http://127.0.0.1:4202/ |
| API Spring | 8083 | http://127.0.0.1:8083/api |
| Oracle | 1551 | — |

No uses `:8083/ventas` para trabajar: ahí solo queda la API (o el modo Docker embebido).

## Puertos (sin chocar con otros proyectos)

| Proyecto | API | Frontend | Oracle | EM |
|----------|-----|----------|--------|----|
| mesa-lista / alimenticio | 8080 | 4200 | 1521 | 5500 |
| control-gastos | 8081 | 4201 | 1522 | 5501 |
| **productos-limpieza** | **8083** | **4202** | **1551** | **5502** |

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

## Modo Docker all-in-one (opcional)

`iniciar-docker.bat` empaqueta Angular dentro del JAR y abre http://localhost:8083/  
Úsalo solo si no quieres `ng serve`.

## Datos

- En operación normal **no** se reimportan semillas JSON (`APP_IMPORT_ON_STARTUP=false`).
- Casa y Muestra siempre quedan en **$0** en la BD.
