# Deuda técnica

Registro de lo que **no** está testeado y de lo que **no** está validado.

**Decisión vigente (2026-08-10):** se baja deliberadamente el esfuerzo de testing hasta completar la
migración de Neon a Supabase. El objetivo actual es terminar el frontend del agente y ponerlo en uso.
Nada de lo listado acá es un descuido: es deuda asumida a conciencia, para saldarse después de la migración.

---

## Restricciones activas

Estas dos reglas mandan sobre cualquier decisión de testing que aparezca abajo.

### 1. No tocar la base de Neon ni los datos de Payload

La base tiene **13 productos aprobados por la doctora**. Es información validada clínicamente y no
reproducible automáticamente. No se modifica, no se borra, no se sobrescribe.

En consecuencia, **hoy no debe ejecutarse ninguna suite que escriba en la base**:

| Comando | Qué escribe |
|---|---|
| `pnpm test:int` | Crea 9 registros, borra por coincidencia de texto, y hace DROP de dos tablas |
| `pnpm test:e2e` | Siembra y borra un usuario de prueba (`tests/e2e/admin.e2e.spec.ts`) |
| `pnpm test` | Ambas cosas: encadena `test:int` y `test:e2e` |

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
| Frontend del agente | **Sin tests** | La UI existe en `src/app/(frontend)/agent/` y funciona, pero no tiene ninguna prueba |
| E2E del agente | **Inexistente** | Los dos specs en `tests/e2e/` son de la plantilla de Payload |
| Cobertura | **Sin herramienta instalada** | No hay ninguna dependencia de coverage en `package.json`. No se puede medir |
| Camino de aclaración | **Sin test** | La rama `kind: 'clarification'` solo está cubierta por instrucción de prompt, no por una prueba |

Los dos e2e existentes además están rotos de fábrica: `frontend.e2e.spec.ts` verifica el título
`Payload Blank Template`, que ya no corresponde a este proyecto.

---

## Divergencias del spec acumuladas

El agente funciona, pero llegar ahí exigió cambios que **contradicen artefactos SDD congelados**.
No se editaron esos artefactos a propósito: son evidencia de qué se especificó. Todo esto entra
en el cambio SDD nuevo, junto con la migración a Supabase.

| Divergencia | Spec que contradice | Motivo |
|---|---|---|
| Modelo `openai/gpt-4o-mini` | `spec.md:27`, `proposal.md:10`, `design.md:5` nombran `deepseek/deepseek-v4-flash` | DeepSeek no soporta salida estructurada nativa; cumplía el schema solo a veces |
| `ClinicalToolset` devuelve `factId` | Contrato de herramientas del diseño | El modelo no puede referenciar IDs que nunca recibió |
| `canShareProtocol` ya no es herramienta | *Bounded streaming execution* lo lista como una de las tres | Costaba O(protocolos) y agotaba el presupuesto; se plegó dentro de `getProductDetails` |
| `testTimeout: 20_000` en Vitest | Evidencia de verificación con el default de 5 s | Los specs de integración corren contra Postgres remoto |

### Deuda de diseño descubierta al depurar

- **El artifact no puede expresar ambigüedad.** `ClinicalArtifact` solo tiene `internalFactIds` y
  `clientFactIds`. Cuando la búsqueda devuelve `kind: 'clarification'`, el modelo no tiene forma
  legal de pedir una aclaración, así que intentaba resolverla cargando todos los candidatos y
  agotaba `maxDetailCalls: 4`. Mitigado por prompt; el flujo real de aclaración es cambio de contrato.
- **`renderClinicalArtifact` emite JSON crudo** (`agent/contracts.ts`), con etiquetas en inglés
  dentro de una UI en español. Los paneles muestran `JSON.stringify` en vez de campos formateados.
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

## Nota sobre la migración a Supabase

Supabase también es Postgres remoto administrado. **La migración no resuelve por sí sola los timeouts**:
la aritmética de round trips secuenciales por latencia de red se reproduce igual. Conviene planificar
el CTE de `acquire()` y una base de test descartable como parte del mismo trabajo.
