---
name: extract-products
description: Extract clinical product files in batches of 10 into normalized Payload CMS JSONs.
---

# Skill: Agente Extractor de Productos Clínicos

Esta skill define el comportamiento del **Agente Extractor**, encargado de procesar los datos de las fichas clínicas comerciales (`real-products/*.md`), los catálogos por categoría (`catalogs/*.md`) y los índices detallados por categoría en **`catalogs/indices/*.md`**, transformándolos en documentos JSON estructurados y enriquecidos para Payload CMS.

---

## Directivas Principales

1. **Búsqueda Cruzada Multifuente:**
   - Para cada producto del lote, el agente debe buscar obligatoriamente en tres fuentes:
     - Ficha comercial del producto (`real-products/<PRODUCTO>.md`).
     - Catálogo de su categoría (`catalogs/<categoria>.md`).
     - **Índice específico en `catalogs/indices/<categoria>.md`** (donde reside el máximo detalle de composición, pureza %, peso molecular kDa, condiciones de almacenamiento, duración y alertas de duda clínica).

2. **Lote Acotado (Máximo 10 productos por lote):**
   - Procesar de a 10 productos por iteración para permitir la revisión clínica iterativa por parte de la Dra. Sara.

2. **Normalización Estricta:**
   - `canonicalName`: Siempre en MAYÚSCULAS SOSTENIDAS (ej: `"BELLATOX"`, `"SOFIDERM DEEP"`).
   - `laboratory`: Nombre limpio del laboratorio desarrollador/distribuidor.
   - `validationStatus`: Setear `"PENDING"` por defecto. Si existen inconsistencias o faltantes graves en la ficha origen, indicar las observaciones detalladas en `validationNotes`.

3. **Principio de Cero Alucinación (Grounding):**
   - Extraer ÚNICAMENTE la información declarada explícitamente en la ficha técnica o catálogo de origen.
   - No asumir volúmenes de reconstitución, diluciones ni dosis que no figuren en los textos. Si un campo no aplica o no está en la fuente, omitirlo o dejarlo nulo.

4. **Estructura de Salida:**
   - Generar un archivo JSON por cada producto en la ruta: `tmp/migration/extracted/<CANONICAL_NAME>.json`.
   - La estructura debe concordar 1:1 con el esquema de la colección `Products` de Payload CMS (`src/collections/Products.ts`).

---

## Formato del JSON de Salida

```json
{
  "canonicalName": "NOMBRE_DEL_PRODUCTO",
  "productType": "liofilizado | liquido | hilos_pdo | dispositivo_medico | insumo | otro",
  "laboratory": "Nombre del Laboratorio",
  "activeIngredients": ["Ingrediente 1", "Ingrediente 2"],
  "aliases": [
    { "term": "Sinonimo 1" }
  ],
  "validationStatus": "PENDING",
  "validationNotes": null,
  "contraindications": ["Contraindicacion 1"],
  "adverseEffects": ["Efecto adverso 1"],
  "presentations": [
    {
      "canonicalName": "NOMBRE_PRESENTACION",
      "status": "activa",
      "aliases": [{ "term": "Sinonimo Presentacion" }],
      "reconstitution": {
        "diluentType": "Solución Fisiológica 0.9%",
        "volumeMl": 2.5,
        "instructions": "Reconstituir suavemente sin agitar bruscamente."
      }
    }
  ]
}
```

---

## Procedimiento por Lote

1. Seleccionar los siguientes 10 archivos de `real-products/*.md` no procesados.
2. Leer y cruzar la información correspondiente con los catálogos en `catalogs/*.md`.
3. Crear el directorio `tmp/migration/extracted/` si no existe.
4. Generar y guardar cada archivo JSON.
5. Reportar el resumen del lote extraído indicando:
   - Productos procesados (nombres).
   - Notas o advertencias clínicas detectadas.
