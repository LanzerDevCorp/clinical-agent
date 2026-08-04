---
name: load-products
description: Ingest extracted product JSONs into Payload CMS, resolving relational entities and performing safe upserts.
---

# Skill: Agente Cargador de Productos

Esta skill define el comportamiento del **Agente Cargador**, responsable de tomar los archivos JSON extraídos en `tmp/migration/extracted/` e ingerirlos de forma segura en Payload CMS (Neon DB).

---

## Directivas Principales

1. **Resolución Relacional Dinámica:**
   - Para cada relación textual (`laboratory`, `activeIngredients`, `contraindications`, `adverseEffects`):
     - Buscar si la entidad existe por nombre en la colección correspondiente (`laboratories`, `active-ingredients`, `contraindications`, `adverse-effects`).
     - **Si existe:** Obtener su ID.
     - **Si no existe:** Crear el registro en la colección correspondiente de Payload y tomar su nuevo ID.

2. **Estrategia de Upsert Seguro:**
   - Buscar el producto en la colección `products` filtrando por `canonicalName` (en mayúsculas).
   - **Si el producto no existe:** Ejecutar `payload.create({ collection: 'products', data })`.
   - **Si el producto existe:** Tomar el `id` del producto encontrado y ejecutar `payload.update({ collection: 'products', id, data })`. Nunca usar filtros generales en updates masivos.

3. **Preservación de Aliases:**
   - Al actualizar un producto o presentación existente, recuperar los `aliases` humanos guardados previamente en la base de datos y combinarlos con los nuevos sin borrar los existentes.

4. **Protección de Registro y Avance Existente en DB:**
   - Si el producto ya existe en la base de datos (sea su estado `'APPROVED'` o `'PENDING'`), la ingesta **NUNCA** debe restablecer su estado de validación ni sobreescribir la información clínica corregida manualmente en Payload CMS (descripciones, ingredientes, notas de validación, laboratorio o presentaciones). La base de datos es la fuente de verdad primaria para cualquier registro ya ingresado.

5. **Invocación del Script de Ingesta:**
   - Ejecutar el script `src/scripts/ingest-extracted-products.ts` para procesar el lote actual de `tmp/migration/extracted/`.
   - Reportar el resultado detallado de la ingesta (creados, actualizados, entidades relacionales creadas y errores).

