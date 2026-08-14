# Agente Cargador

Ingiere los JSON que dejó el Agente Extractor en `tmp/migration/extracted/` y los
carga en Payload mediante `src/scripts/ingest-extracted-products.ts`.

## Por qué hay un agente si ya hay un script

El script es deliberadamente **determinista**: resuelve por igualdad exacta y no
toma decisiones clínicas. Todo lo que requiere criterio lo deja anotado en un
reporte en vez de resolverlo solo.

El trabajo del agente es lo otro: preparar la corrida, leerla, y ocuparse de lo
que el script se negó a decidir. Si el agente empieza a "arreglar" datos por su
cuenta, se perdió el punto.

## Producción es el destino

Cada lote se carga en **producción** antes de extraer el siguiente. El entorno
local queda para pruebas y desarrollo; no es parte de este flujo y no hace falta
mantenerlo al día.

Eso se apoya en un hecho del esquema: los productos nuevos entran `PENDING`, y el
agente clínico solo consulta los `APPROVED` (`repository.ts` filtra por
`validationStatus`). **Un producto recién cargado es invisible en el chat hasta que
la doctora lo aprueba.** El lote no puede hacer daño por sí solo.

Donde sí hay riesgo es en los **registros relacionales compartidos** —
contraindicaciones, cuidados posteriores, advertencias, efectos adversos — porque
esos se enganchan también a los productos que **ya están aprobados**. Un registro
mal fusionado ahí toca datos vivos. Todas las precauciones de abajo apuntan a eso.

## Restricciones que no se negocian

- **Respaldo antes de cada lote.** Sin respaldo verificado no se corre la ingesta.
  Hay productos aprobados por la doctora que no se pueden reconstruir.
- **Ensayo antes de escribir.** Primero la corrida en seco, que muestra qué se
  crearía y qué se tocaría de lo existente. Recién con eso revisado se escribe.
- **Los comandos de base de datos los corre el usuario.** El agente propone el
  comando y espera. Un comando pegado en el chat sin el prefijo `!` no es
  autorización.
- **`ALLOW_REMOTE_DATABASE=1` va en el comando, nunca en un script de
  `package.json`.** Si alcanzar producción deja de ser explícito, deja de ser una
  decisión.
- **No se pierde ningún registro existente.** El script preserva `validationStatus`,
  descripción, notas y relaciones al actualizar. Esa preservación no se toca.
- **El agente no aprueba productos.** Todo entra `PENDING`; aprobar es de la
  doctora.

## Secuencia

1. **Volcar el vocabulario de producción** a `tmp/migration/vocabulary.json` con
   `DATABASE_URL=<producción> ALLOW_REMOTE_DATABASE=1 pnpm db:vocabulary`. Es lo
   que el Agente Extractor necesita como entrada, y se regenera antes de cada lote.
2. **Verificar el lote**: que los JSON de `tmp/migration/extracted/` estén bien
   formados y traigan `canonicalName`, `laboratory` y al menos una presentación.
3. **Respaldar producción.** Proponer el comando y esperar.
4. **Proponer la corrida en seco** y revisar con el usuario qué registros
   compartidos se crearían o reutilizarían.
5. **Proponer la ingesta real** al usuario. Esperar a que la corra.
6. **Leer el reporte** y resolver lo que quedó abierto.
7. **Informar** qué se creó, qué se actualizó, qué falló y qué necesita a la
   doctora.

## Qué hacer con el reporte

El script deja tres clases de cosas sin resolver, a propósito:

**Casi-duplicados.** Un término nuevo que se parece a uno existente pero no es
idéntico. El script **no fusiona**: crea el registro nuevo y lo reporta. El
agente los lista para revisión humana. Si dos textos difieren en un número, son
dos registros y no hay nada que discutir — eso ni siquiera se reporta.

**Contraindicaciones sin tipo.** El extractor omite `type` cuando la ficha no lo
permite decidir. El script las crea como `absoluta` —el lado seguro— y las
reporta. El agente las lista para que la doctora las confirme o las baje a
`relativa`.

**Errores por archivo.** Un producto que falló no detiene la corrida, pero el
script termina con código 1. El agente reporta cuáles fallaron y por qué, sin
reintentar a ciegas.

## Reglas que el script debe cumplir

Estas son las decisiones de diseño que el código tiene que respetar. Si una
lectura del código las contradice, es defecto del código, no de este documento.

| Regla | Estado |
| --- | --- |
| Modo de ensayo (`--dry-run`) que informa sin escribir, marcando qué registros compartidos tocaría | pendiente |
| Precargar el vocabulario de la base una vez, no consultar por término y por producto | pendiente |
| Resolver por **igualdad exacta** normalizada; nada de fusión difusa automática | pendiente |
| Conservar los tokens numéricos al comparar (hoy `filter(w => w.length > 2)` los descarta) | pendiente |
| Veto numérico: conjuntos de números distintos ⇒ registros distintos, sin importar la similitud | pendiente |
| El tipo de contraindicación llega en el JSON; sin él, crear `absoluta` y reportar | pendiente |
| Una descripción, un solo tipo: si hay discrepancia, gana la más restrictiva | pendiente |
| Terminar la corrida completa y salir con `1` si hubo errores | pendiente |
| Escribir un reporte con el resultado por archivo | pendiente |
| Preservar aliases, estado, descripción y relaciones de los productos existentes | **ya implementado** |
| Upsert por `canonicalName` en mayúsculas | **ya implementado** |

### El defecto que originó estas reglas

`tokenSimilarity` filtra tokens con `w.length > 2`, lo que descarta todo número de
una o dos cifras antes de comparar. Verificado ejecutando el algoritmo:

```
1.00  "…primeras 12 horas…"  vs  "…primeras 24 horas…"     → fusionaría
1.00  "…solar por 24 horas"  vs  "…solar por 48 horas"     → fusionaría
0.00  "Embarazo"             vs  "Lactancia"               → separa, correcto
```

El matcher no es malo en general: es ciego exactamente donde vive la precisión
clínica.

## Un caso aislado que se resuelve a mano

Si un producto declara una contraindicación con un tipo distinto al que ya tiene
ese mismo texto en la base, el registro compartido se queda con la más
restrictiva. Si el caso amerita distinguirlos, se crea el registro aparte
**manualmente** desde el admin. No es trabajo del agente.
