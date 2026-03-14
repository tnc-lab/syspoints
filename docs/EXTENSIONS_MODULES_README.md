# Syspoints Extensions (Modules)

Este documento define como construir, subir y activar extensiones seguras para Syspoints.

## Objetivo

El sistema de extensiones usa **paquetes .zip** con manifiesto declarativo JSON (sin ejecución de código JavaScript de terceros).

Esto permite extender funcionalidades sin comprometer el servidor.

## Flujo de administración

1. Ingresar como `admin`.
2. Ir a la sección **Admin > Modulos**.
3. Subir archivo `.zip` del módulo.
4. Activar el módulo.
5. El módulo empieza a afectar el cálculo de puntos en reviews nuevas.

## Reglas de seguridad

- No se ejecuta código dinámico (`eval`, `Function`, scripts externos).
- Solo se permite el motor `syspoints-module-v1`.
- Permisos soportados: `points:adjust` y `review:share`.
- Validación estricta de esquema y claves permitidas.
- Límite de tamaño del manifiesto: `250KB`.
- Límite de tamaño del paquete `.zip`: `5MB`.
- Hash SHA-256 del manifiesto guardado para auditoría.
- Activación/desactivación solo por endpoints admin autenticados.
- Puntos finales acotados en backend (`min 0`, `max 1000`).
- Cada módulo subido se guarda y extrae en disco en su carpeta propia: `modules/<module_key>/`.

## Estructura del .zip

El archivo `.zip` debe incluir un archivo `manifest.json` (o `module.json`).

Ejemplo de estructura:

```txt
review-share.zip
└── manifest.json
```

## Estructura del manifiesto

```json
{
  "name": "bonus-high-stars",
  "version": "1.0.0",
  "description": "Bono por reviews de 5 estrellas con evidencia.",
  "engine": "syspoints-module-v1",
  "execution_order": 100,
  "permissions": ["points:adjust"],
  "hooks": {
    "points_adjustments": [
      {
        "id": "bonus-five-stars-with-evidence",
        "delta": 2,
        "when": {
          "stars_gte": 5,
          "evidence_count_gte": 1
        }
      },
      {
        "id": "penalty-short-description",
        "delta": -1,
        "when": {
          "description_length_lte": 80
        }
      }
    ]
  }
}
```

## Campos soportados

- `name`: slug en minúsculas (`[a-z0-9._-]`, 2-50 chars).
- `version`: formato semver core (`x.y.z`).
- `description`: opcional, hasta 200 chars.
- `engine`: debe ser `syspoints-module-v1`.
- `execution_order`: entero entre `1` y `10000`.
- `permissions`: arreglo no vacío, solo `points:adjust`.
- `hooks.points_adjustments`: arreglo no vacío (máx. 50 reglas) si usas `points:adjust`.
- `hooks.review_share`: objeto requerido si usas `review:share`.

Cada regla admite:

- `id`: identificador único por módulo.
- `delta`: entero entre `-100` y `100`.
- `when`: condiciones declarativas.

Condiciones soportadas en `when`:

- `stars_gte`, `stars_lte`
- `price_gte`, `price_lte`
- `description_length_gte`, `description_length_lte`
- `evidence_count_gte`, `evidence_count_lte`
- `tags_count_gte`, `tags_count_lte`

## Endpoints admin

- `GET /admin/modules`: listar módulos.
- `POST /admin/modules`: subir módulo en `.zip` (base64 en `data_url`).
- `POST /admin/modules/:moduleKey/activate`: activar.
- `POST /admin/modules/:moduleKey/deactivate`: desactivar.

## Módulo de share listo para usar

Plantilla incluida en:

- `docs/modules/review-share.module.json`
- `docs/modules/review-share.module.zip`

Ese módulo activa el bloque `Compartir/Share` debajo de cada review con redes:

- Telegram
- X
- WhatsApp
- LinkedIn
- Facebook
- Instagram

Los puntos por compartir se configuran en admin con `share_points_bonus`.

## Recomendaciones

- Versionar cada cambio de módulo (`1.0.0`, `1.1.0`, etc.).
- No reutilizar `name@version`.
- Probar en entorno de staging antes de activar en producción.
- Mantener reglas simples, auditables y con impacto acotado.
