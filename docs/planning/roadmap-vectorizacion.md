# Roadmap: búsqueda vectorial para el agente clínico

Registrado el 2026-09-04. Estimaciones de esfuerzo asumen un desarrollador con
dedicación enfocada, reutilizando la infraestructura actual (Supabase/Postgres
local, Payload, Vercel AI SDK) sin sumar un proveedor de vector DB nuevo —
pgvector sobre la misma Postgres. Si cambia el equipo o la infraestructura,
las estimaciones deben revisarse.

## Punto de partida

Agente clínico ya en funcionamiento con consultas deterministas vía Local API
de Payload. Catálogo real (72 productos) más un fixture ficticio
(`invented-catalogue.json`) para cubrir casos límite. `RAG/vector retrieval`
quedó explícitamente fuera de alcance en v1 (ver
`openspec/changes/payload-backed-clinical-agent/exploration.md:34`).

## Fases

### Fase 0 — Hecho
Agente clínico operativo, consultas deterministas contra Payload.

### Fase 1 — Catálogo aprobado (gate de negocio, no esfuerzo de desarrollo)
Hasta que el catálogo completo esté aprobado no conviene vectorizar en serio,
porque cualquier producto nuevo o corregido obliga a re-embeber. No bloquea
las Fases 2 y 3, que pueden avanzar en paralelo.

### Fase 2 — Colección de FAQ (~2-3 días)
- Definir la collection en Payload (pregunta, respuesta, categoría, producto
  relacionado opcional).
- Hook de embedding al crear/actualizar (mismo patrón que para productos).
- Popular contenido: el tiempo real depende del volumen de FAQ que se
  definan; con 15-20 es cosa de un día, con 100+ es un proyecto de contenido
  en sí mismo.

### Fase 3 — Minería de conversaciones de Callbell (variable — mayor riesgo del roadmap)
- Exportar conversaciones y anonimizar antes de que cualquier dato clínico
  toque un prompt o un embedding.
- Identificar patrones recurrentes: qué preguntas no cubre bien el catálogo
  actual, qué merece convertirse en FAQ, qué merece vectorizarse como
  producto.
- Es trabajo de análisis, no solo de desarrollo. El tiempo depende
  directamente del volumen de conversaciones y de si se pueden exportar
  estructuradas o hay que revisarlas a mano.
- **Pendiente de datos**: volumen aproximado de conversaciones y si existe
  una vía de exportación. Sin esto, esta fase no se puede acotar.

### Fase 4 — Infraestructura de vectorización (~3-4 días)
- Columna/tabla pgvector en la Postgres existente.
- Elegir proveedor de embeddings (vía AI Gateway, sin atarse a un solo
  proveedor).
- Hook `afterChange`/`afterDelete` para productos y FAQ, upsert/delete por
  `id` de documento.
- Script de backfill para el catálogo aprobado + FAQ ya cargadas.

### Fase 5 — Routing híbrido en el agente (~2-3 días)
- Segunda tool de búsqueda vectorial junto a la determinista existente.
- Con AI SDK no hace falta un clasificador aparte: se definen ambas tools
  con buenas descripciones y el modelo elige según la pregunta.

### Fase 6 — Pulido y evaluación (~3-5 días)
- Iterar primero con el fixture ficticio + una muestra chica de FAQ, no con
  todo el volumen — un dataset curado que cubra casos límite permite
  detectar fallas más rápido que el catálogo completo desde el inicio.
- Ajustar el criterio de cuándo usar cada camino (determinista vs
  vectorial) y el tono de las respuestas comparativas.

### Fase 7 — Rollout a producción
- Migrar embeddings del catálogo real y las FAQ definitivas.
- Monitorear.

## Estimación total

Desarrollo puro (Fases 2, 4, 5, 6, sin contar la Fase 3): **10-15 días
hábiles** de una persona con dedicación enfocada.

La Fase 3 (Callbell) puede estirar el total de dos semanas a un mes y medio.
Es la única fase que no se puede acotar sin conocer el volumen de
conversaciones y la vía de exportación disponible.

## Abierto

- Volumen aproximado de conversaciones de Callbell y forma de exportarlas.
- Cantidad de FAQ previstas para la Fase 2.
- Confirmación de si el desarrollo lo lleva una sola persona o hay más manos
  disponibles (afecta directamente el rango de días hábiles de arriba).
