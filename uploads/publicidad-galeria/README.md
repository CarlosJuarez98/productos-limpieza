# Galería Amorcas (publicidad)

Aquí se guardan las imágenes que agregas desde la pantalla **Publicidad → Galería Amorcas**.

- `manifest.json` — qué se muestra (se crea solo al arrancar el API)
- Archivos `up-….jpg/png` — fotos subidas

Las piezas base (ropa, trastes, etc.) siguen en `frontend/public/publicidad/` y no se borran del disco al quitarlas de la galería.

En la nube esta carpeta se monta en el contenedor para no perderlas al redesplegar.
