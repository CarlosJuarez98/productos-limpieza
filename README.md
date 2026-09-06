# Productos de limpieza

Control de ventas, inventario, entradas, caja y apartados — equivalente digital del Excel `Productos de limpieza.xlsx`.

Stack: **Spring Boot 3** + **Angular 19** + **base de datos propia** (H2 local por defecto; Oracle Docker opcional).

## Base de datos propia (no compartida)

Este proyecto **no mezcla** datos con Programa-alimenticio / mesa-lista ni con Oracle ORCL de otros sistemas.

Por defecto usa un archivo exclusivo del proyecto:

`A:\Negocios\productos-limpieza\db\productos_limpieza.*`

| Campo | Valor |
|-------|-------|
| Usuario | `plimpieza` |
| Password | `plimpieza_local` |
| Consola | http://localhost:8083/h2-plimpieza |
| JDBC | `jdbc:h2:file:../db/productos_limpieza` |

### Oracle opcional (también exclusivo, vía Docker)

```powershell
docker compose up -d oracle
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=oracle"
```

| Campo | Valor |
|-------|-------|
| Contenedor | `oracle-productos-limpieza` |
| Puerto | **1522** |
| Service | `XEPDB1` |
| Usuario | `productos_limpieza` |
| Password | `ProductosLimpieza2026` |
| Volumen | `oracle-productos-limpieza-data` |

## Módulos

| Pantalla | Equivale a |
|----------|------------|
| Ventas | Hoja Ventas |
| Entradas | Compras a proveedor |
| Inventario | Stock, márgenes, uso en casa |
| Caja | Corte, retiros, ingresos, transferencias |
| Apartados | General / productos / casa / salarios |
| Histórico / Lista precios | Precios por vigencia y lista actual |
| Inversión | Inversión inicial + infraestructura |

## Arranque rápido (recomendado)

Doble clic en:

| Archivo | Qué hace |
|---------|----------|
| `iniciar.bat` | Abre backend + frontend |
| `iniciar-backend.bat` | Solo API |
| `iniciar-frontend.bat` | Solo Angular |

Puertos de este proyecto (no chocan con los demás):

| Servicio | Puerto |
|----------|--------|
| Backend API | **8083** |
| Frontend Angular | **4201** |

- Frontend: http://localhost:4201/
- API: http://localhost:8083/api

## Arranque manual

API en puerto **8083**.

### Backend (BD propia)

```powershell
cd A:\Negocios\productos-limpieza\backend
$env:JAVA_HOME = "A:\Descargas\Desarrollo\sts-4.24.0.RELEASE\plugins\org.eclipse.justj.openjdk.hotspot.jre.full.win32.x86_64_21.0.3.v20240426-1530\jre"
$env:PATH = "$env:JAVA_HOME\bin;A:\Descargas\Desarrollo\apache-maven-3.9.9\bin;" + $env:PATH
mvn spring-boot:run
```

API: http://localhost:8083/api

### Frontend

```powershell
cd A:\Negocios\productos-limpieza\frontend
npm start
```

App: http://localhost:4201

La primera vez que la BD está vacía, importa automáticamente el Excel desde `data/`.
