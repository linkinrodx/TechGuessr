# UI Screenshots for UIGuessr

Esta carpeta contiene las imágenes de interfaces de usuario para el modo UIGuessr.

## Estado actual: mockups originales (no screenshots reales)

Los 16 archivos `.svg` de esta carpeta son **mockups generados
programáticamente**, no capturas de pantalla reales de cada app. Cada uno
recrea la paleta de color de marca y un layout genérico según el tipo de
interfaz (feed, reproductor, bandeja de entrada, perfil, chat, etc.), sin
copiar el diseño real de ningún producto.

Se optó por este enfoque en vez de screenshots reales porque Wikimedia
Commons prohíbe explícitamente subir capturas de interfaces propietarias
salvo que todo el contenido tenga licencia libre (ver
[Commons:Screenshots](https://commons.wikimedia.org/wiki/Commons:Screenshots/en)).
Usar y desplegar screenshots reales de Twitter, Facebook, Instagram, etc.
en un proyecto público sin licencia es un riesgo de copyright que no vale
la pena para el MVP.

Regenerar los mockups (o agregar apps nuevas) con:

```bash
node scripts/generate-ui-mockups.js
```

El script vive en `scripts/generate-ui-mockups.js` en la raíz del repo.

## Reemplazo con screenshots reales (opcional, futuro)

Si en algún momento se cuenta con capturas propias o con permiso explícito
de uso, se pueden reemplazar los `.svg` por `.png`/`.jpg` reales:

1. Guardar la imagen en esta misma carpeta con el mismo nombre base que en
   `src/app/data/ui-screenshots.json` (ej. `twitter-2010.png`).
2. Actualizar el campo `imageUrl` correspondiente en ese JSON.
3. Si la app ya está desplegada en AWS, volver a correr el script de
   migración (`infra/scripts/migrate-ui-screenshots.ts`) para actualizar
   la tabla `techguessr-ui-screenshots` en DynamoDB.

Requisitos si se usan imágenes reales:
- Formato: PNG o JPG
- Resolución recomendada: 800-1200px de ancho
- Verificar licencia/permiso de uso antes de subir

## Dataset

El contenido de texto (app, acción, año, explicación) para cada mockup
vive en `src/app/data/ui-screenshots.json`.
