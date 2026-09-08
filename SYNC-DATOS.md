# Sync de datos local → nube (productos-limpieza)

## Acuerdo

1. Desarrollas y registras en **local**.
2. Cuando digas **“sube a la nube”**, se sube:
   - **código** (solo si cambió; Docker usa caché)
   - **datos** desde Oracle local → ATP

## Script actual

Copia completa (todas las tablas de negocio):

```powershell
cd A:\Programas-java\Negocios\productos-limpieza
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
```

Requisitos: Docker local (`oracle-productos-limpieza`), SSH a la VM, wallet en `~/productos-limpieza/wallet`.

## Notas

- Fuente de verdad en operación: **Oracle** (local mientras desarrollas; ATP en la nube).
- No reinyectar JSON de semillas en la nube si la BD ya tiene datos.
- Si más adelante hace falta sync **incremental** (solo filas nuevas), se puede añadir como en control-gastos.
