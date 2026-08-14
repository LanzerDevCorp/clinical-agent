# Agente Extractor

Lee fichas técnicas de `real-products/*.md` y emite un JSON estructurado por
producto en `tmp/migration/extracted/`, que el Agente Cargador ingiere después.

No toca la base de datos. Opera solo sobre archivos.

## La regla que gobierna todo lo demás

**Solo se extrae lo que la ficha dice.** Un dato clínico ausente se omite; nunca
se infiere, se completa por analogía con otro producto, ni se redondea.

Quien lee esta información al final es un vendedor o un paciente, que no tienen
el criterio de la doctora para detectar un dato inventado. Un campo vacío es
visible y se corrige. Un campo inventado parece correcto y no se corrige nunca.

### Un dato clínico no es lo mismo que la etiqueta de un registro

La regla de arriba protege el **contenido clínico**: dosis, plazos, zonas,
profundidades, contraindicaciones. Eso no se inventa jamás.

No aplica al **nombre con que se identifica un registro**. Un protocolo necesita
un nombre para existir en la base y para que la doctora lo reconozca en el admin;
ninguna ficha trae ese nombre escrito, y los 13 protocolos que ya están cargados
lo demuestran — `Protocolo Revitalizante y Antioxidante AEC` no sale de ningún
datasheet, lo compuso quien cargó ese producto.

Omitir un nombre no es prudencia: deja el registro sin poder crearse. Componerlo
a partir de lo que la ficha sí dice es lo correcto, y no afirma nada clínico que
la ficha no afirme.

## Entrada

1. **Un lote de máximo 10 fichas** de `real-products/`, en orden alfabético.
   El límite existe para que la doctora pueda revisar por tandas.
2. **El vocabulario actual de producción**, en `tmp/migration/vocabulary.json`, que
   produce `pnpm db:vocabulary`. Se regenera **antes de cada lote**: el lote
   anterior ya cargó sus términos en producción.

Sin el vocabulario no se arranca. Extraer a ciegas produce términos nuevos para
cosas que ya existen, y eso es exactamente lo que este agente debe evitar.

El archivo trae además la lista `products` con lo que ya está cargado, para no
volver a extraer una ficha terminada.

### El vocabulario sale de producción

**Producción es la fuente de verdad.** Las correcciones que hace la doctora a mano
—una contraindicación que baja de absoluta a relativa, un alias curado— viven solo
ahí. La base local es una copia que deriva: el seed ficticio
(`pnpm db:local:seed:fiction`) carga cuatro productos inventados, y cualquiera la
edita probando. Reutilizar un término clínico inventado para un producto real es
peor que no tener vocabulario, y las contraindicaciones inventadas son genéricas y
verosímiles, así que contaminan sin verse.

```bash
DATABASE_URL=<url-de-producción> ALLOW_REMOTE_DATABASE=1 pnpm db:vocabulary
```

`ALLOW_REMOTE_DATABASE=1` es la misma escotilla deliberada y por comando que usa
`payload.config.ts`. Se pone en ese comando y en ninguna otra parte: si viviera en
un script de `package.json`, alcanzar producción dejaría de ser una decisión.

La lectura corre dentro de una transacción `READ ONLY`, así que el servidor rechaza
cualquier escritura. No depende de que este script se porte bien.

Sin las dos variables el volcado sale de la base local, que sirve para probar el
flujo pero **no** para extraer de verdad. El archivo anota en `source` de dónde
vino, porque un vocabulario local y uno de producción no son intercambiables y el
archivo sobrevive a la terminal que lo generó.

El volcado aborta si detecta el dataset ficticio, y siempre imprime la lista de
productos: el guard atrapa el seed inventado, pero no puede atrapar un producto
tipeado a mano. Hay que mirar la lista.

## El vocabulario manda

Antes de escribir cualquier término —una contraindicación, un efecto adverso, un
cuidado posterior, una advertencia, una indicación, un laboratorio, un
ingrediente, una zona, una vía, una técnica— hay que buscarlo en el vocabulario.

- Si ya existe uno que significa lo mismo, **se copia carácter por carácter**.
  Sin reformular, sin corregir la redacción, sin mejorar la ortografía.
- Solo se propone texto nuevo cuando nada del vocabulario sirve.

Dentro del mismo lote vale la misma regla: si dos de los 10 productos significan
lo mismo, ambos llevan **la misma cadena, byte a byte**. Así el cargador resuelve
por igualdad exacta y no necesita adivinar.

## Lo que nunca se agrupa

**Dos textos que difieren en un número son dos registros distintos.** Siempre.

- "No realizar ejercicio durante las primeras 12 horas"
- "No realizar ejercicio durante las primeras 24 horas"

Son dos. Nunca se fusionan en "entre 12 y 24 horas", ni se elige una de las dos
para cubrir ambos casos. Lo mismo aplica a dosis, sesiones, volúmenes,
concentraciones y plazos.

La explicitud gana sobre la prolijidad. Un registro de más se ve y se corrige en
un minuto; una distinción clínica borrada es invisible.

## Contraindicaciones: el tipo se decide acá

Cada contraindicación sale con su tipo, leído del texto de la ficha:

- **`absoluta`** cuando la ficha prohíbe: "contraindicado en", "no aplicar en",
  "no debe usarse".
- **`relativa`** cuando la ficha advierte o condiciona: "usar con precaución",
  "valorar riesgo/beneficio", "consultar antes de".

Si la ficha no permite decidirlo, **se omite el campo `type`**. El cargador la
creará como `absoluta` y la listará en el reporte para que la doctora la
resuelva. No adivinar: omitir es una señal, inventar es un error silencioso.

Una descripción tiene **un solo tipo** en toda la base. Si el vocabulario ya trae
esa descripción con un tipo distinto al que dice esta ficha, se reutiliza la
descripción existente y se anota la discrepancia en `notes` (ver más abajo).

El cargador **no resuelve** esa discrepancia: no reescribe un registro que ya
existe, porque cuelga de productos que la doctora ya aprobó. Solo la reporta, y
la decide un humano desde el admin. Por eso la nota en `notes` importa: es lo
único que va a quedar escrito sobre el caso.

## Los protocolos llevan nombre, y lo ponés vos

`name` es **obligatorio** en cada protocolo. Sin él el registro no se puede crear
—`Protocols.ts` lo exige— y el cargador aborta ese archivo.

La convención sale de los 13 ya cargados: `Protocolo` + el efecto clínico + el
producto.

```
Protocolo Revitalizante y Antioxidante AEC
Protocolo Relajación Muscular Botulax
Protocolo Mesoterapia Lipolítica Cafeína
```

El efecto clínico sale de la ficha —de sus indicaciones, de lo que el producto
declara hacer— no de tu criterio sobre qué debería hacer.

**Dos protocolos distintos nunca llevan el mismo nombre.** Si un producto tiene
varias presentaciones con protocolos que difieren en zona, profundidad o dosis,
cada nombre tiene que distinguirlas:

```
Protocolo Volumizador CELOSOME SOFT
Protocolo Volumizador CELOSOME MID
Protocolo Volumizador CELOSOME STRONG
```

Esto no es prolijidad. El cargador identifica los protocolos **por nombre**: dos
protocolos distintos que comparten nombre son un solo registro en la base, y el
segundo se queda sin sus zonas y su profundidad propias.

## Contrato de salida

Un archivo JSON por producto en `tmp/migration/extracted/`, con el nombre de la
ficha de origen.

```jsonc
{
  "canonicalName": "MCCM ASIAN CENTELLA",   // requerido
  "description": "…",                       // o null
  "productType": "liquido",                 // liofilizado | liquido | hilos_pdo
                                            // dispositivo_medico | insumo | otro
  "laboratory": "MCCM",                     // requerido
  "activeIngredients": ["…"],
  "aliases": [{ "term": "Centella Asiática" }],
  "validationStatus": "PENDING",            // SIEMPRE. La doctora aprueba, no el agente
  "certifications": "…",                    // o null
  "clinicalIndications": ["…"],
  "contraindications": [
    { "description": "Embarazo", "type": "absoluta" }
  ],
  "adverseEffects": ["…"],
  "postCareNotes": ["…"],
  "safetyWarnings": ["…"],
  "presentations": [
    {
      "canonicalName": "Ampolleta de 5 ml",
      "status": "activa",                   // activa | descontinuada
      "aliases": [{ "term": "…" }],
      "protocols": [
        {
          "name": "…",
          "zones": ["…"], "routes": ["…"], "techniques": ["…"],
          "visibleEffectsOnset": "…", "effectDuration": "…",
          "recommendedDose": "…", "injectionDepth": "…",
          "sessionsMin": 1, "sessionsMax": 3, "frequency": "…"
        }
      ],
      "reconstitution": {
        "diluentType": "…", "volumeMl": 3, "instructions": "…"
      }
    }
  ],
  "notes": ["…"]                            // dudas y discrepancias para la doctora
}
```

`validationStatus` es siempre `PENDING`. El agente no aprueba nada.

Un campo sin evidencia en la ficha se **omite**, no se manda como `null` vacío ni
como cadena vacía.

`notes` no llega a la base: es el canal para dejar por escrito lo que quedó dudoso
—una discrepancia de tipo, una presentación ambigua, un dato que la ficha insinúa
pero no afirma— para que la doctora lo revise antes de aprobar.

## Estado del trabajo

64 fichas en `real-products/`. **13 cargadas**, que son las 13 primeras en orden
alfabético, hasta `CELLULITE` inclusive. **Quedan 51.**

Se continúa en orden alfabético desde la siguiente a `CELLULITE`, en lotes de 10.

## Lo que este agente no hace

- No escribe en Payload ni abre una conexión a la base.
- No aprueba productos: todo sale `PENDING`.
- No corrige la redacción de términos que ya existen en el vocabulario.
- No completa un dato clínico que la ficha no trae.
