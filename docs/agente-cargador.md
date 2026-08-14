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

## La base local es el destino

Cada lote se carga en la **base local**, nunca directo en producción. Ahí se
revisa, se corrige a mano, y recién entonces se promueve. Producción se alcanza en
un paso aparte, después de que un humano miró el lote entero.

Eso cambia lo que la base local es. Dejó de ser un entorno de pruebas y pasó a ser
la **antesala**: ya no da lo mismo que derive. Entre lote y lote se rehace a partir
de lo que la doctora aprobó en producción, y ese refresco **nunca** ocurre con un
lote cargado sin promover — rehacerla a mitad de lote borra la revisión sin aviso.

Con esa disciplina, la base local siempre es una de dos cosas: una copia exacta de
producción, o esa misma copia más un lote en revisión. Nunca otra cosa. De eso
depende que comparar contra el vocabulario signifique algo.

### La red que sigue estando en producción

La revisión local no reemplaza la garantía que da el esquema. Los productos nuevos
entran `PENDING`, y el agente clínico solo consulta los `APPROVED`
(`repository.ts` filtra por `validationStatus`). **Un producto promovido es
invisible en el chat hasta que la doctora lo aprueba.**

Donde sí hay riesgo es en los **registros relacionales compartidos** —
contraindicaciones, cuidados posteriores, advertencias, efectos adversos — porque
esos se enganchan también a los productos que **ya están aprobados**, y que el
producto nuevo esté `PENDING` no los aísla. Cargar primero en local es
exactamente lo que da la oportunidad de ver ese enganche antes de que toque datos
vivos.

## Restricciones que no se negocian

- **Respaldo antes de promover, no antes de cargar.** La carga en local no lo
  necesita: esa base se rehace desde producción cuando haga falta. Lo que exige
  respaldo verificado es el paso que escribe en producción, porque ahí hay
  productos aprobados por la doctora que no se pueden reconstruir.
- **Ensayo antes de escribir.** Primero la corrida en seco, que muestra qué se
  crearía y qué se tocaría de lo existente. Recién con eso revisado se escribe.
  Vale para local también: el ensayo es donde se ve el enganche a registros
  compartidos, y verlo tarde en local cuesta lo mismo que verlo tarde en producción.
- **Los comandos que tocan producción los corre el usuario.** El agente propone el
  comando y espera. Un comando pegado en el chat sin el prefijo `!` no es
  autorización. Los comandos contra la base local el agente los corre solo: esa
  base es reconstruible y no hay nada ahí que no se pueda rehacer.
- **`ALLOW_REMOTE_DATABASE=1` va en el comando, nunca en un script de
  `package.json`.** Aplica al volcado del vocabulario y a la promoción, que son los
  dos únicos pasos que alcanzan producción. Si alcanzarla deja de ser explícito,
  deja de ser una decisión.
- **No se pierde ningún registro existente.** El script preserva `validationStatus`,
  descripción, notas y relaciones al actualizar. Esa preservación no se toca.
- **El script no reescribe un registro compartido que ya existe.** Sobre
  contraindicaciones, cuidados posteriores, advertencias y efectos adversos solo
  puede crear registros nuevos o enlazar los que ya están. Nunca cambia el texto
  ni el tipo de uno existente, porque ese registro cuelga de productos que la
  doctora ya aprobó. Una discrepancia se reporta; no se resuelve escribiendo.
- **El agente no aprueba productos.** Todo entra `PENDING`; aprobar es de la
  doctora.

## Secuencia

1. **Refrescar la base local desde producción**, si viene de un lote ya promovido.
   Es lo que garantiza que local sea copia exacta antes de empezar. Los comandos
   están en el encabezado de `src/scripts/extract-real-catalogue.mjs`, y terminan
   en `pnpm db:local:reset`.
2. **Volcar el vocabulario** a `tmp/migration/vocabulary.json` con
   `pnpm db:vocabulary`. Sale de producción —
   `DATABASE_URL=<producción> ALLOW_REMOTE_DATABASE=1` — apenas la doctora empieza
   a corregir a mano, porque esas correcciones viven solo ahí. Mientras local sea
   una copia verificada y sin cambios de por medio, alcanza con el volcado local.
   El archivo anota en `source` de dónde vino; no son intercambiables.
3. **Verificar el lote**: que los JSON de `tmp/migration/extracted/` estén bien
   formados y traigan `canonicalName`, `laboratory` y al menos una presentación.
4. **Corrida en seco contra local**, y revisar qué registros compartidos se
   crearían o reutilizarían.
5. **Ingesta real en local.**
6. **Leer el reporte** y resolver lo que quedó abierto.
7. **Entregar el lote a revisión humana** en el admin local, diciendo con precisión
   qué se creó, qué se reutilizó y qué quedó anotado para la doctora.
8. **Promover a producción** una vez revisado, con respaldo previo. Ese paso lo
   corre el usuario, y todavía no tiene herramienta: ver el paso 4 del flujo.
9. **Informar** qué llegó a producción y qué necesita a la doctora.

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
| Una descripción, un solo tipo: si hay discrepancia con un registro existente, reportarla sin escribir | pendiente |
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
ese mismo texto en la base, el script **no toca el registro existente**: lo deja
como está, enlaza el producto nuevo y anota la discrepancia en el reporte.

Ese registro cuelga de productos que la doctora ya aprobó. Subirlo a `absoluta`
sería el lado seguro para el producto que entra y un cambio silencioso de
criterio clínico para todos los que ya estaban — decidido por un script, sobre
datos ya firmados. Eso no se hace solo.

La resolución es humana y se hace desde el admin: o se cambia el tipo del
registro compartido, o se crea uno aparte para distinguirlos. No es trabajo del
agente.
