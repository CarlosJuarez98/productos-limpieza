# Sync de datos local ↔ nube (productos-limpieza)

## Direcciones

| Acción | Script | Dirección |
|--------|--------|-----------|
| **Sube a la nube** | `scripts\sync-datos-completo.ps1` | Local → ATP (dump completo) |
| **Baja de la nube** | `scripts\sync-datos-desde-nube.ps1` | ATP → Local (dump completo) |

Convenio de los 3 proyectos: `A:\Programas-java\SYNC-BIDIRECCIONAL.md`.

## Notas

- Fuente de verdad en operación: **Oracle** (local mientras desarrollas; ATP en la nube).
- No reinyectar JSON de semillas si la BD ya tiene datos.
- Duplicados (`ORA-00001`) se omiten al importar.

## Comandos

```powershell
cd A:\Programas-java\Negocios\productos-limpieza

# Subir
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-completo.ps1

# Bajar (misma password de wallet ATP que usaste al generar el zip)
powershell -ExecutionPolicy Bypass -File .\scripts\sync-datos-desde-nube.ps1 -WalletPassword 'WalletPass2798Aa'
```

Requisitos: Docker local (`oracle-productos-limpieza`), SSH a la VM, wallet en `~/productos-limpieza/wallet`.
