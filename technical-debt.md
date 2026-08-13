# Deuda técnica

Registro de lo que **no** está testeado y de lo que **no** está validado.

**Decisión del 2026-08-10:** se bajó deliberadamente el esfuerzo de testing hasta completar la
migración de Neon a Supabase. Nada de lo listado acá es un descuido: es deuda asumida a conciencia,
para saldarse después de la migración.

**La migración terminó el 2026-08-12, así que esa deuda venció.** El plazo que la justificaba se
cumplió, y además desapareció el obstáculo que la hacía cara de pagar: ya existe una base local
descartable contra la cual correr las suites sin tocar datos clínicos. Lo de abajo dejó de ser
deuda diferida y pasó a ser trabajo pendiente.

---

## Restricciones activas

Estas dos reglas mandan sobre cualquier decisión de testing que aparezca abajo.

### 1. No tocar los datos clínicos de producción

La base de producción tiene **13 productos aprobados por la doctora**. Es información validada
clínicamente y no reproducible automáticamente. No se modifica, no se borra, no se sobrescribe.

**Actualizado el 2026-08-12:** producción dejó de ser Neon y pasó a Supabase, y el desarrollo
dejó de apuntar a producción. La regla ya no depende de que alguien se acuerde:
`payload.config.ts` **aborta el arranque** si `DATABASE_URL` apunta a un host no local fuera de
un deployment, y `.env` local ya no contiene credenciales de producción.

Eso cambia el estado de las suites. Siguen escribiendo en la base, pero ahora escriben en la
**local**, que es descartable y se reconstruye con `pnpm db:local:reset`:

| Comando | Qué escribe |
|---|---|
| `pnpm test:int` | Crea 9 registros, borra por coincidencia de texto, y hace DROP de dos tablas |
| `pnpm test:e2e` | Siembra y borra un usuario de prueba (`tests/e2e/admin.e2e.spec.ts`) |
| `pnpm test` | Ambas cosas: encadena `test:int` y `test:e2e` |

O sea que el motivo original para no correrlas —que escribían en la base de la doctora— ya no
existe. Volver a habilitarlas es una decisión pendiente, no un impedimento técnico.

**Mientras esa decisión no se tome: no ejecutarlas sin pedir autorización.** Vale para personas y
para agentes. Que el impedimento técnico haya desaparecido no es lo mismo que tener permiso, y el
costo de correrlas por las suyas está descrito justo abajo.

Detalle relevante: `tests/int/clinical-agent-route.int.spec.ts:44-46` deja las tablas
`clinical_agent_admission_events` y `clinical_agent_admission_leases` **dropeadas al terminar**. Si la
suite corre contra la base en uso, la ruta del chat responde 503 hasta que se vuelva a aplicar la migración.

Y `tests/int/clinical-product-query-postgres.int.spec.ts:45-46` borra productos cuyo `canonicalName`
*contenga* `Runtime Clinical` y protocolos que contengan `Runtime shareable`. Es un `contains`, no un match exacto.

### 2. No gastar créditos de Vercel AI Gateway

No se escriben ni se ejecutan tests que consuman créditos del Gateway.

Estado actual: **ningún test los consume hoy**. Los tres archivos que mencionan el gateway usan dobles:

| Archivo | Cómo evita el gasto |
|---|---|
| `tests/int/gateway-preflight.int.spec.ts` | Recibe `fetch` inyectado como parámetro |
| `tests/int/clinical-agent-orchestrator.int.spec.ts` | Gateway falso y timers falsos |
| `tests/int/clinical-agent-route.int.spec.ts` | Gateway falso vía `routeHarness()` |

Regla para cualquier test nuevo: el proveedor se inyecta, siempre. Ningún test toca el Gateway real.

---

## Tests que no existen

| Área | Estado | Notas |
|---|---|---|
| Frontend del agente | **Casi sin tests** | Lo único cubierto es el cuerpo que el cliente envía (`tests/int/clinical-chat-request-body.int.spec.ts`). El render, el manejo de eventos del stream y los estados de error de `ClinicalChat.tsx` siguen sin prueba |
| E2E del agente | **Inexistente** | Los dos specs en `tests/e2e/` son de la plantilla de Payload |
| Cobertura | **Sin herramienta instalada** | No hay ninguna dependencia de coverage en `package.json`. No se puede medir |
| Camino de aclaración | **Sin test** | La rama `kind: 'clarification'` solo está cubierta por instrucción de prompt, no por una prueba |

Los dos e2e existentes además están rotos de fábrica: `frontend.e2e.spec.ts` verifica el título
`Payload Blank Template`, que ya no corresponde a este proyecto.

---

## Divergencias del spec acumuladas

El agente funciona, pero llegar ahí exigió cambios que **contradicen artefactos SDD congelados**.
No se editaron esos artefactos a propósito: son evidencia de qué se especificó. Todo esto entra
en el cambio SDD nuevo. La migración a Supabase, que antes se listaba acá como parte del mismo
paquete, se completó el 2026-08-12.

| Divergencia | Spec que contradice | Motivo |
|---|---|---|
| El artefacto llega por la tool `submitClinicalArtifact`, no por `Output.object` | `design.md:14` especifica `Output.object` para devolver las referencias a facts | El modelo que el propio spec fija (`deepseek/deepseek-v4-flash`, `design.md:5`) tiene tool calling pero no formato de respuesta JSON nativo. Los inputs de una tool **sí** los valida el proveedor contra el schema; los formatos de respuesta no. Ver `gateway.ts:6-12` |
| `ClinicalToolset` devuelve `factId` | Contrato de herramientas del diseño | El modelo no puede referenciar IDs que nunca recibió |
| `canShareProtocol` ya no es herramienta | *Bounded streaming execution* lo lista como una de las tres | Costaba O(protocolos) y agotaba el presupuesto; se plegó dentro de `getProductDetails` |
| `testTimeout: 20_000` en Vitest | Evidencia de verificación con el default de 5 s | Se subió porque los specs corrían contra Postgres remoto y `acquire()` encadena round trips secuenciales. **Desde el 2026-08-12 el desarrollo corre contra Postgres local**, así que esa justificación ya no aplica y el valor está sin volver a medir |
| `ClinicalAgentEvent.artifact` lleva facts, no strings | El evento especificado transporta texto renderizado | La presentación pertenece a la UI; un string no se puede maquetar ni copiar por partes |

### Resuelto: el agente re-respondía el historial completo

Cerrado el 2026-08-12 en `686980f`. `requestBody()` mandaba todo el historial y la ruta solo
acepta `role: 'user'`, así que el modelo veía una lista de preguntas sin respuestas
intercaladas y las contestaba todas: consultar "BOTULAX" llenaba la card interna con ASIAN
CENTELLA, ARTICHOKE y BOTULAX a la vez. Ahora se envía **una sola pregunta por request**.

Queda cubierto por `tests/int/clinical-chat-request-body.int.spec.ts`, que se probó fallando
con el cuerpo viejo. Derivar `internalFactIds` del ledger no causó el defecto: lo hizo
visible, porque antes el re-trabajo consumía presupuesto en silencio.

### Deuda abierta: el agente no tiene memoria conversacional

Consecuencia aceptada del arreglo anterior. Cada pregunta llega sola, sin antecedente: un
"¿y su dosis?" después de preguntar por un producto no tiene a qué referirse.

La salida es admitir turnos de assistant en el contrato de la ruta, que hoy los rechaza
(`route.ts:69`). Es **cambio de spec** y no se hizo junto con el arreglo a propósito: enviar
una pregunta sola es correcto aunque limitado, y el contrato nuevo merece diseñarse, no
improvisarse mientras se apaga un incendio.

### Defecto abierto: la búsqueda es sensible a tildes

`discoveryWhere` en `repository.ts` filtra con `contains`, que Postgres resuelve como
`ILIKE '%query%'` — **sensible a acentos**. Verificado contra la base:

| Consulta | Resultado |
|---|---|
| `Centella Asiática` | ASIAN CENTELLA |
| `Centella Asiatica` (sin tilde) | **sin resultados** |

El código tiene una función `normalized()` que quita tildes y pasa a minúsculas, pero se
aplica solo al **ordenar** los candidatos, después de que el filtro de base ya descartó la
fila. En la práctica esa normalización nunca se ejerce sobre lo que importa.

Para un catálogo clínico en español es serio: *Ácido Hialurónico*, *Vitamina C (Ácido
Ascórbico)*, *Centella Asiática*. Quien escriba sin tilde no encuentra nada.

**Mitigación actual, no arreglo:** el prompt le sugiere al modelo reintentar con la variante
acentuada cuando la búsqueda vuelve vacía. Depende de que el modelo adivine la forma
almacenada.

**Arreglo real:** normalizar de ambos lados en la base — extensión `unaccent` de Postgres, o
una columna normalizada mantenida por hook. Toca `repository.ts`, que es Flow 1 especificado
y con 35 tests, así que va al cambio SDD nuevo.

Relacionado y también sin arreglar: la búsqueda es de **subcadena literal, no de palabras**,
así que `"Asian Centella protocolo"` no encuentra nada aunque `"Asian Centella"` sí. Hoy se
mitiga por prompt (pasar solo el nombre del producto).

### Deuda de diseño descubierta al depurar

- **El artifact no puede expresar ambigüedad.** `ClinicalArtifact` solo tiene `internalFactIds` y
  `clientFactIds`. Cuando la búsqueda devuelve `kind: 'clarification'`, el modelo no tiene forma
  legal de pedir una aclaración, así que intentaba resolverla cargando todos los candidatos y
  agotaba `maxDetailCalls: 4`. Mitigado por prompt; el flujo real de aclaración es cambio de contrato.
- ~~`renderClinicalArtifact` emite JSON crudo~~ — **resuelto**. El evento `artifact` ahora lleva los
  facts estructurados (`selectClinicalArtifactFacts`) y la UI los renderiza por `kind`. Esto suma
  otra divergencia del spec: cambió la forma de `ClinicalAgentEvent`.
- **El `Reference: <uuid>` del error opaco no se loguea en ningún lado.** Se le entrega al usuario
  un identificador que no sirve para rastrear nada. Los diagnósticos temporales que se usaron para
  depurar esto ya se removieron; una observabilidad permanente y segura queda pendiente.
- **`search:${facts.length}` es un ID posicional.** Hoy no rompe porque el modelo lo recibe en el
  resultado, pero depende del orden de registro y es frágil ante cualquier cambio de flujo.

### Datos, no código

`client_shareable = true` en **0 de 13** protocolos. El panel del paciente aparece vacío porque
nadie autorizó nada todavía — el sistema falla cerrado como corresponde. Se habilita marcando
protocolos en el admin de Payload.

---

## Lo que no está validado

### Ejecución pendiente

- **La suite completa no se re-ejecutó** después de subir `testTimeout` a 20 s (commit `c00b67a`).
  Que los dos tests de admisión ahora pasen es una expectativa fundada en la aritmética de latencia,
  **no un hecho medido**.
- Último estado conocido de esos dos tests: timeout a los 5 s en la suite completa
  (`clinical-agent-route.int.spec.ts:106` y `:122`), pasando en la suite de cinco archivos.

### Gates de rollout externos

Ninguno se ejecutó. Todos requieren entorno destino y autorización explícita.

| Gate | Estado |
|---|---|
| Migración de admisión contra entorno destino | Pendiente. Solo hay evidencia local reversible |
| Configuración de Vercel Fluid | Pendiente. En código están el runtime Node y `maxDuration=180` |
| Preflight del modelo exacto contra Gateway real | Pendiente **y bloqueado** por la restricción de créditos |
| Deploy a staging | Pendiente |
| Canary de duración real 150 s < 180 s | Pendiente |

### Verificación SDD

El cambio `streaming-clinical-agent-backend` quedó en **`FAIL` admitido**:

- Requisitos 7/8, escenarios 21/22, tareas 12/12.
- Evidence revision `sha256:9f70ef84…`. Archive **bloqueado**.
- La autoridad de runtime está **agotada**: se consumieron la única corrección acotada y la única
  re-verificación independiente permitidas. No resetear ni re-verificar sobre ese candidato.
- Los tres blockers originales están cerrados. Lo que bloquea es el timeout de la suite completa.

Cuando se migre a Supabase habrá que abrir un cambio SDD nuevo para re-verificar la capa de admisión.

---

## Deuda de diseño en los tests existentes

| Problema | Dónde | Impacto |
|---|---|---|
| La suite de integración corre contra una base remota compartida, no contra una descartable | `src/payload.config.ts:70-75` | Causa raíz de los timeouts y del riesgo sobre los datos |
| El `afterAll` deja tablas dropeadas | `clinical-agent-route.int.spec.ts:44-46` | Rompe la ruta del chat después de correr los tests |
| Requiere datos preexistentes o lanza excepción | `clinical-product-query-postgres.int.spec.ts:54-56` | No corre contra una base limpia |
| Si la corrida se corta, quedan 9 registros huérfanos `Runtime …` | `clinical-product-query-postgres.int.spec.ts:111-123` | Ensucia la base ante cualquier interrupción |
| `environment: 'jsdom'` global | `vitest.config.mts` | Los specs de Node y Postgres pagan construcción de DOM que no usan |
| Aserción obsoleta | `clinical-agent-orchestrator.int.spec.ts:275` | Lee `output.at(-1)` del setup anterior en vez de `toolRejected.output`, así que no ejerce la corrida de nueve tool calls |
| RED original de las Units 2-4 no conservado | `apply-progress.md` | La evidencia TDD está reconstruida, no capturada |

---

## Deuda de producto

| Ítem | Dónde | Notas |
|---|---|---|
| `acquire()` hace 8 round trips secuenciales | `src/lib/clinical-agent/agent/admission.ts:51-89` | Colapsables a uno o dos con un CTE. Latencia real en cada request. Sobrevive a cualquier migración de base |
| El cliente vuelve al pool en transacción abortada si el `ROLLBACK` falla | `src/lib/clinical-agent/agent/admission.ts:90-101` | `node-postgres` no resetea estado de sesión al liberar. El siguiente que tome esa conexión puede recibir `current transaction is aborted`. Solo alcanzable en caminos de error de base |

---

## Migración a Supabase: completada el 2026-08-12

La predicción se cumplió: Supabase también es Postgres remoto administrado, y la migración por sí
sola no resolvió los timeouts — la aritmética de round trips secuenciales por latencia se reproduce
igual contra cualquier base remota.

De las dos cosas que esta nota pedía planificar, **una está hecha**: existe la base descartable, y no
como base de test sino como entorno de desarrollo entero. Supabase local vía CLI, reconstruible con
`pnpm db:local:reset`, con catálogo ficticio sembrado. Eso saca la latencia de red de la ecuación en
desarrollo, que era la causa real de los timeouts.

**Sigue pendiente el CTE de `acquire()`.** Contra la base local ya no molesta, pero producción sigue
siendo remota y ahí los round trips se pagan igual.
