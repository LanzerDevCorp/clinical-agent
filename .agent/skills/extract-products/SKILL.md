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
   - `description`: Párrafo descriptivo o resumen técnico introductorio extraído de la ficha comercial (`real-products/<PRODUCTO>.md`), limpio de marcas de formato Markdown (`**`).
   - `productType`: Debe ser uno de los enums válidos: `"liofilizado"`, `"liquido"`, `"hilos_pdo"`, `"dispositivo_medico"`, `"insumo"`, `"otro"`.
   - `laboratory`: Nombre limpio del laboratorio desarrollador/distribuidor.
   - `reconstitution`: Si el producto es líquido/listo para usar y no requiere reconstitución, explicitar:
     `{ "diluentType": "No requiere", "volumeMl": null, "instructions": "Solución líquida lista para usar. No requiere reconstitución ni dilución previa." }`.
   - `zones`, `routes`, `techniques`: Arrays de strings divididos por elementos individuales (ej: `["Facial", "Cuello"]` en lugar de `"Facial y Cuello"`).
   - `validationStatus`: Setear `"PENDING"` por defecto. Si existen inconsistencias o faltantes graves en la ficha origen, indicar las observaciones detalladas en `validationNotes`.

3. **Principio de Cero Alucinación (Grounding):**
   - Extraer ÚNICAMENTE la información declarada explícitamente en la ficha técnica o catálogo de origen.
   - No asumir volúmenes de reconstitución, diluciones ni dosis que no figuren en los textos. Si un campo no aplica o no está en la fuente, omitirlo o dejarlo nulo.

4. **Estructura de Salida:**
   - Generar un archivo JSON por cada producto en la ruta: `tmp/migration/extracted/<CANONICAL_NAME>.json`.
   - La estructura debe concordar 1:1 con el esquema de la colección `Products` de Payload CMS (`src/collections/Products.ts`).

5. **Desduplicación Inteligente y Normalización Ortográfica:**
   - El agente extractor debe corregir faltas de ortografía y homogeneizar variantes de nexos (ej: preferir término canónico `"Embarazo y lactancia"` sobre `"Embarazo o lanctancia"`).
   - El script de ingesta cuenta con un algoritmo de coincidencia difusa (distancia de Levenshtein + similitud de tokens ≥ 80%) que detecta variantes o erratas leves y reutiliza el ID del registro existente en la BD sin crear duplicados.

6. **Desglose Semántico por Intención Clínica (Secciones Mixtas/Generales):**
   - Cuando la ficha de origen contenga secciones heterogéneas o agrupadas como `## RECOMENDACIONES:`, `## CONSIDERACIONES:`, `## NOTAS:` o `## REACCIONES:`, **NO clasificar por el título de la sección**. El agente debe analizar e interpretar cada punto individualmente según su intención clínica:
     - **Contraindicaciones (`contraindications`)**: Frases de prohibición o situaciones donde NO se debe aplicar (ej: *"No aplicar en heridas"*, *"Contraindicado en embarazo/lactancia"*, *"Intolerancia a componentes"*).
     - **Cuidados Post-Aplicación (`postCareNotes`)**: Instrucciones o conducta sugerida tras el procedimiento (ej: *"No exponer al sol por 48h"*, *"Usar fotoprotector FPS 50+"*, *"Evitar ejercicio el primer día"*).
     - **Advertencias de Seguridad (`safetyWarnings`)**: Precauciones de manipulación técnica, conservación o perfil profesional (ej: *"Uso exclusivo por profesional sanitario"*, *"Mantener refrigerado entre 2°C y 8°C"*, *"Desechar vial al abrir"*).
     - **Efectos Adversos (`adverseEffects`)**: Reacciones corporales esperadas o eventos adversos fisiológicos (ej: *"Eritema en sitio de punción"*, *"Dolor leve"*, *"Edema transitorio"*).
     - **Reconstitución / Dilución (`reconstitution`)**: Instrucciones explícitas de mezcla o volumen de diluyente (ej: *"Reconstituir con 1 mL de solución salina 0.9%"*).

---

## Formato del JSON de Salida

```json
{
  "canonicalName": "NOMBRE_DEL_PRODUCTO",
  "description": "Párrafo descriptivo o resumen técnico del producto extraído de la ficha comercial...",
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
      "certifications": "Registro sanitario / certificación",
      "protocols": [
        {
          "name": "Nombre descriptivo del protocolo de aplicación",
          "visibleEffectsOnset": "Inicio de efectos (ej: 5 a 7 días)",
          "effectDuration": "Duración del efecto (ej: 4 a 6 meses)",
          "recommendedDose": "Dosis recomendada y calibre de aguja (ej: 2-4 UI)",
          "injectionDepth": "Profundidad de inyección (ej: Intradérmica)",
          "zones": ["Zona de aplicación (ej: Facial, Corporal)"],
          "routes": ["Vía de administración (ej: Intradérmica, Subcutánea)"],
          "techniques": ["Técnica (ej: Mesoterapia, Dermapen)"],
          "sessionsMin": 4,
          "sessionsMax": 6,
          "frequency": "Frecuencia (ej: Cada 2 semanas)"
        }
      ],
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
