# Sync de datos local ↔ nube (productos-limpieza)

## Fuente de verdad

- **Datos reales:** nube (ATP).
- **Local:** pruebas. No se suben datos al decir “sube a la nube”.
- En operación la fuente es **Oracle** (no Excel / no reinyectar JSON de semillas si la BD ya tiene datos).

## Preferencia

- **Bajar datos** = lo habitual para contexto real en local.
- **Subir datos** = excepcional (solo cambios intencionales que deban vivir en prod).
- Nunca contaminar prod con datos de prueba locales.

## Direcciones

| Frase | Script | Dirección |
|-------|--------|-----------|
| **Sube datos** | `scripts\sync-datos-completo.ps1` | Local → ATP (dump completo) |
| **Baja datos** / **baja de la nube** | `baja-datos.bat` o `scripts\sync-datos-desde-nube.ps1` | ATP → Local (dump completo) |
| **Sube / lleva a la nube** | (código) | merge a `nube`; deploy = tu bat; **sin** sync de datos |

Atajo global (menú): `A:\Programas-java\BAJAR-DATOS-DE-LA-NUBE.bat`.

Convenio de los 3 proyectos: `A:\Programas-java\SYNC-BIDIRECCIONAL.md`.

## Notas

- Duplicados (`ORA-00001`) se omiten al importar.

## Comandos

```powershell
cd A:\Programas-java\Negocios\productos-limpieza

# Bajar datos (doble clic o)
.\baja-datos.bat
# equivalente:
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-desde-nube.ps1 -WalletPassword 'WalletPass2798Aa'

# Subir datos (excepcional)
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1
```

Requisitos: Docker local (`oracle-productos-limpieza`), SSH a la VM, wallet en `~/productos-limpieza/wallet`.
