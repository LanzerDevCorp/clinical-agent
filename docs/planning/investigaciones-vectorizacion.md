# Investigaciones: vectorización del catálogo para el agente clínico

Registro de las consultas de investigación resueltas antes de definir el
roadmap (ver `roadmap-vectorizacion.md` en esta misma carpeta). Registrado el
2026-09-04.

## Investigación 1: estrategia de vectorización

### ¿Se puede vectorizar por partes, o tiene que ser toda la base de una sola vez?

La vectorización es granular por diseño, no un proceso monolítico. Se genera
el embedding de un registro (o de un chunk de ese registro) y se guarda con
un ID que lo referencia. Todos los vector stores relevantes — pgvector,
Pinecone, Weaviate, Qdrant — soportan upsert/delete de un vector individual
por ID.

### Al actualizar un dato, ¿hay que re-vectorizar toda la db o solo ese registro?

Solo ese registro. El flujo normal es: create/update → embed ese documento →
upsert; delete → se borra su vector. Re-vectorizar todo solo hace falta en
dos casos puntuales, que son migraciones de una sola vez, no rutina:

- Se cambia el modelo de embeddings (cambian las dimensiones o la semántica
  del espacio vectorial).
- Se cambia la estrategia de chunking (qué campos se incluyen, cómo se
  parte el texto).

### Aplicado a Payload

No hay campo vector nativo en Payload core. El patrón estándar es un hook
`afterChange` en la collection correspondiente que llama a un proveedor de
embeddings con los campos relevantes del documento y hace upsert en una
tabla pgvector (la misma Postgres de Supabase, sin infraestructura nueva)
usando el `id` del documento como clave. En `afterDelete` se borra esa fila.

### ¿Es necesario subir toda la información antes de pulir el agente?

No. Para afinar criterio y calidad de respuesta conviene lo contrario: un
subconjunto chico y curado que cubra los casos límite sirve más que el
catálogo completo desde el arranque. Con todo el volumen de entrada hay
ruido — cuesta distinguir si una falla es por un caso raro o por el volumen.
Con pocos ejemplos curados, cada falla es diagnosticable.

En este proyecto ya existe la herramienta para esto:
`src/scripts/fixtures/invented-catalogue.json`, con 4 productos ficticios
pensados para cubrir las dos formas que el catálogo real no tiene (producto
descontinuado, producto sin presentación). Flujo recomendado:

1. Pulir el agente contra ese fixture chico hasta que el criterio y el tono
   cierren en los casos borde.
2. Validar contra `real-catalogue.json` (catálogo real) para confirmar que
   no rompe con datos reales.
3. Recién ahí llevarlo a producción.

## Investigación 2: consultas híbridas (determinista + vectorial)

### Una vez vectorizada la db, ¿se pueden combinar consultas deterministas (como funciona hoy) y vectoriales (para comparativas)?

Sí. Es un patrón con nombre — **retrieval híbrido** o *query routing* — y es
lo recomendado cuando un solo tipo de búsqueda no cubre todos los casos de
uso.

- **Determinista** (como ya funciona hoy vía Local API de Payload): para
  preguntas de hecho exacto ("¿cuál es el precio de X?", "¿X tiene
  presentación Y?"). Un vector search acá agrega ruido semántico a una
  pregunta que tiene una sola respuesta correcta y exacta en la base.
- **Vectorial**: para preguntas de similitud o comparación donde no hay un
  match exacto sino una relación semántica ("¿qué alternativas hay para
  tratar Z?", "¿qué productos se parecen a X en indicación?").

### Cómo se implementa

No se reemplaza lo que existe, se suma como una segunda herramienta. El
agente (o un paso de routing previo) clasifica la pregunta por su forma y
elige qué tool invocar: la consulta determinista existente contra
Payload/Postgres, o una consulta de similitud contra pgvector. Ambas se
pueden combinar en una sola respuesta — primero candidatos por similitud
vectorial, después verificación/enriquecimiento con una lectura determinista
exacta sobre esos IDs.

Con Vercel AI SDK esto se resuelve definiendo dos `tools` y dejando que el
modelo elija cuál invocar según la pregunta, sin necesidad de un
clasificador separado — es una extensión del patrón de tool-calling que ya
usa el agente actual.

### Contexto del proyecto

`openspec/changes/payload-backed-clinical-agent/exploration.md:34` registra
que RAG/vector retrieval quedó explícitamente fuera de alcance para v1: "no
evidence requires semantic retrieval now". Esta investigación es la base
para evaluar si conviene incorporarlo en una siguiente iteración.
