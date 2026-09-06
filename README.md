# Productos de limpieza

Control de ventas, inventario, entradas, caja y apartados — equivalente digital del Excel `Productos de limpieza.xlsx`.

Stack: **Spring Boot 3** + **Angular 19** + **Oracle XE en Docker** (base propia).

## Puertos (sin chocar con otros proyectos)

| Proyecto | API | Frontend | Oracle | EM |
|----------|-----|----------|--------|----|
| mesa-lista | 8080 | 4200 | 1521 | 5500 |
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

## Arranque

Doble clic en `iniciar.bat`

Eso levanta Oracle (Docker), el backend, el frontend y abre el navegador en http://127.0.0.1:4202/

- App: http://127.0.0.1:4202/
- API: http://127.0.0.1:8083/api
