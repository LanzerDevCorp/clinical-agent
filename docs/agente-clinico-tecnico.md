# Agente Clínico — Referencia técnica

Asistente de consulta en `/agent`: un profesional pregunta por un producto del
catálogo y recibe dos paneles — datos internos completos, y una versión filtrada
que puede compartir con el paciente. No es un chat de propósito general; es una
consulta de catálogo con una sola decisión clínica delegada al modelo.

Ver `docs/agente-clinico.md` para la versión de negocio (sin detalle de
implementación).

## Qué resuelve y qué no

El problema real no es "hablar con una IA sobre estética" — es que el catálogo
tiene decenas de productos con contraindicaciones, reconstitución y protocolos
que un vendedor o una médica no memoriza, y que hoy solo vive en fichas técnicas
dispersas. El agente le ahorra a esa persona buscar en PDFs: pregunta el nombre
del producto, y recibe exactamente lo que el catálogo tiene registrado, sin que
el modelo agregue ni infiera nada que no esté ahí.

Lo que **no** hace, a propósito: no compara productos, no resuelve interacciones
entre dos sustancias, no recuerda la conversación anterior, y no opina sobre
dosis para un paciente particular. Es una consulta de un producto por vez, y solo
repite lo que el catálogo dice.

## Arquitectura del agente

```
ClinicalChat.tsx (useChat)
        │  una sola pregunta por request (request-body.ts)
        ▼
POST /api/chat  ──►  admisión (rate limit) ──►  orchestrator.run()
                                                       │
                                    gateway.stream()  ◄┤  tools (search/details)
                                    (AI SDK + DeepSeek) │  repository.ts (Payload)
                                                       ▼
                                    submitClinicalArtifact (única salida)
                                                       │
                                                       ▼
                                    ledger → artifact { internal[], client[] }
```

- **`route.ts`** — autentica, aplica el rate limit (`admission.ts`, tablas
  `clinical_agent_admission_events`/`_leases`), y arranca el orquestador.
- **`orchestrator.ts`** — corre el loop del modelo con tres relojes en paralelo:
  timeout total (150 s), timeout al primer fragmento de respuesta (45 s) y
  timeout por herramienta (30 s). Un reintento si la falla es reintentable. Nunca
  dos preguntas a la vez.
- **`gateway.ts`** — el puente al AI SDK (`deepseek/deepseek-v4-flash`, vía AI
  Gateway). El modelo nunca escribe prosa: solo puede llamar herramientas.
- **`tools.ts` + `repository.ts`** — `searchProducts` y `getProductDetails` son
  la única forma de tocar datos. `repository.ts` lee con
  `overrideAccess: true` porque ya se autoriza sola (cualquier cuenta
  `users` autenticada) — no depende de si el catálogo está cerrado por rol.
- **`contracts.ts`** — el punto de diseño que sostiene todo lo demás: cada
  resultado de herramienta se guarda en un *ledger* con un `factId`, y el modelo
  solo puede citar esos IDs en su respuesta final. No puede escribir un dato
  clínico de memoria porque no hay dónde escribirlo — solo puede señalar algo que
  ya quedó registrado.
- **`prompt.ts`** — el guion fijo: un producto por pedido, buscar antes de pedir
  detalle, y la única decisión que le toca es qué protocolos son aptos para
  compartir con el paciente.

### Por qué no alucina

No es una promesa del prompt, es una restricción estructural.
`validateClinicalArtifact` (`contracts.ts`) rechaza cualquier factId que el
modelo no haya recibido de una herramienta real, y si no se registró ningún dato
interno, la corrida se descarta entera (no llega a la UI como éxito vacío). El
"para el paciente" pasa por el mismo filtro: solo protocolos que la base marcó
`clientShareable` pueden entrar a esa lista, sin importar lo que el modelo pida.

## Roles y quién puede hacer qué

Tres roles, un solo modelo de acceso repetido en todas las colecciones del
catálogo (`adminOrMedico`, `src/access/`):

| Rol | Chat | Catálogo (panel + API) | Multimedia | Cuenta |
|---|---|---|---|---|
| **admin** | Sí | Lectura y escritura | Lectura y escritura | Crea/edita cualquier cuenta, desbloquea, resetea contraseñas |
| **medico** | Sí | Lectura y escritura | Lectura y escritura | Solo la propia |
| **user** (vendedor) | Sí | Bloqueado (panel y API) | Bloqueado | Solo la propia — es lo único que ve en el panel |

Puntos que no son obvios mirando solo el código de una colección:

- El cierre de acceso es real, no cosmético: antes de esta ronda, `Products`,
  `Protocols`, `Media` y las 12 colecciones de taxonomía no tenían ningún control
  de escritura propio — el default de Payload (`Boolean(user)`) dejaba crear,
  editar o borrar a cualquier cuenta autenticada. Ahora todas pasan por
  `adminOrMedico`.
- El chat sigue funcionando para el rol `user` a pesar de ese cierre porque
  `repository.ts` no depende del acceso de la colección — tiene su propio gate
  (`isInternalUserRequest`, cualquier cuenta `users`) y lee con
  `overrideAccess: true`.
- **Contraseñas temporales.** Toda cuenta que crea un admin, o cuya contraseña
  resetea un admin, queda marcada `mustChangePassword: true`
  (`manageMustChangePassword.ts`). Mientras esa marca siga activa, la cuenta no
  entra al chat ni al catálogo — solo puede llegar a `/admin/account` a
  cambiarla. Se apaga sola cuando la cuenta cambia su propia contraseña.
- `Users.access.unlock` está restringido a admin — antes cualquier cuenta podía
  desbloquear cualquier otra, y el botón "Forzar Desbloqueo" se lo mostraba a
  todos por el mismo motivo.

## La interfaz en Payload

El panel de admin (`/admin`) es Payload sin fork — todo lo que se le agregó es
aditivo, vía los slots que Payload expone para eso
(`admin.components` en `payload.config.ts`), nunca reemplazando una vista
entera:

- **`beforeDashboard` → `RedirectSalesToAccount`.** Un `user` no tiene nada que
  ver en el Dashboard — cada colección del catálogo lo rechaza — así que se lo
  manda directo a su perfil. Admin y médico no lo notan: el Dashboard real no se
  toca.
- **`beforeNavLinks` → `AgentNavLink`.** Un botón fijo al chat, sin gate de rol,
  arriba de los links de colecciones.
- **`beforeLogin` → `LoginThemeToggle` + `HideForgotPassword`.** El primero
  expone el `useTheme()` propio de Payload (distinto del `next-themes` que usa
  el chat) antes de loguearse. El segundo oculta "Olvidé mi contraseña" por CSS
  estructural (`form.login__form > a`, el único link que cuelga directo del
  formulario) — no hay flujo de self-service por email en este proyecto, las
  contraseñas las entrega un admin.
- **Campo `role` oculto por `admin.condition`** en el perfil de cualquiera que
  no sea admin — no es de solo lectura, directamente no se renderiza.
- **Español forzado.** `supportedLanguages` solo tiene `es` — el panel
  dependía de que el navegador mandara `Accept-Language: es`, y con inglés el
  panel entero salía en inglés pese a `fallbackLanguage: 'es'`.

Todo componente nuevo se registra en `src/app/(payload)/admin/importMap.js`
(generado). En dev, ese archivo se regenera en caliente al guardar
`payload.config.ts`, pero el **proceso ya corriendo** puede quedarse con una
copia vieja en memoria — un componente nuevo en un array (`beforeLogin`,
`beforeNavLinks`) puede no aparecer hasta reiniciar `pnpm dev`. Pasó dos veces
en esta sesión; ver `.next/dev/logs/next-development.log` para el error exacto
(`getFromImportMap: PayloadComponent not found`) si vuelve a pasar.

## Cómo funciona con la base de datos

Postgres local vía Supabase CLI (`supabase start`, contenedores
`supabase_*_clinical-agent`), producción vía Supabase real. Payload es dueño del
esquema — las tablas nacen de migraciones en `src/migrations/`, nunca de
`supabase db push` ni de tocar Postgres a mano salvo para reparar drift (más
abajo).

- **Catálogo**: `Products` con `presentations` como array embebido (no una
  colección aparte), relacionado contra las 12 colecciones de taxonomía
  (laboratorios, tipos, contraindicaciones, etc.). Solo `validationStatus:
  APPROVED` es visible para el agente — `PENDING` existe en la base pero el
  chat lo trata como si no existiera.
- **Usuarios**: `Users` con `role` (admin/medico/user) y `mustChangePassword`,
  ambos columnas Postgres reales (enum y boolean), no campos calculados.
- **Rate limiting**: dos tablas fuera del modelo de colecciones de Payload —
  `clinical_agent_admission_events` y `clinical_agent_admission_leases` —
  creadas a mano en `20260812_000001_clinical_agent_admission.ts` porque no
  representan un documento editable, son puramente operativas (ventana de 1
  hora, máximo 2 corridas concurrentes por usuario).
- **Drift conocido, no resuelto**: esas dos tablas de admisión desaparecieron
  dos veces en esta sesión después de un `supabase start`, con el resto de la
  base intacta y `payload migrate:status` igual reportando la migración como
  aplicada. No se aisló el mecanismo exacto — la hipótesis más fuerte apunta al
  ciclo `stop`/`start` del CLI local, pero no hay evidencia definitiva. Mientras
  no se cierre, correr `pnpm payload migrate` después de cualquier
  `supabase start` es gratis (`CREATE TABLE IF NOT EXISTS`, no toca nada
  existente) y hasta ahora siempre lo resolvió.
- **Producción se migra a mano.** El build de Vercel no corre `payload
  migrate` — es un paso deliberado, con `DATABASE_URL` real y
  `ALLOW_REMOTE_DATABASE=1` en ese único comando, después del deploy que trae
  el código correspondiente. Toda migración agregada en esta sesión (rol
  médico, `mustChangePassword`) sigue pendiente de aplicarse ahí.

## Qué se espera a partir de ahora

El agente y el cierre de acceso están funcionalmente completos y probados a
nivel de lógica: 118 tests de integración contra Postgres real, cubriendo el
ciclo completo de contraseña temporal, la matriz de acceso por rol y colección,
y el proyector que evita reabrir el bug de "responde cada pregunta pasada otra
vez". Lo que **no** está probado es la experiencia real en navegador — esta
sesión no tuvo acceso a credenciales reales ni pudo levantar un Chromium
headless (el sandbox no completa la descarga del binario). Cada cambio de UI de
esta sesión fue verificado por código, tipos y, cuando fue posible, HTML
servido — nunca clickeado.

Antes de que un usuario real (la doctora, un vendedor) toque esto, falta como
mínimo:

1. **Migrar producción** con todo lo de esta sesión (rol médico,
   `mustChangePassword`, y cualquier migración pendiente) y confirmar que el
   flujo de contraseña temporal funciona ahí — nadie lo vio en un navegador
   real todavía.
2. **Recorrido manual completo**: login con contraseña temporal → redirect a
   `/admin/account` → cambio de contraseña → chat funcionando; menú de cuenta
   con "Perfil"/"Catálogo"/"Cerrar sesión" según rol; el toggle de tema en
   login; el botón de multimedia y colecciones realmente ocultos para `user`.
3. **Asignar el rol médico** a la cuenta real de la doctora — hoy sigue en el
   rol que tenía antes de esta ronda de cambios.

## Próximos pasos para que quede listo para usuarios reales

En orden de impacto, no de esfuerzo:

1. **Contexto de la última respuesta, no todo el historial.** El proyector
   manda solo la pregunta actual — a propósito, para no reabrir el bug de
   re-respuesta — pero eso también significa que "¿y las contraindicaciones?"
   como segunda pregunta no tiene idea de qué producto se preguntó antes.
   Mandar la última pregunta *junto con su artefacto* (no el historial crudo)
   resuelve la continuidad sin tocar el motivo original por el que se limitó.
2. **El botón de error no siempre es "Reintentar".** Un 401 (sesión expirada)
   muestra el mismo botón que un 503 — reintentar un 401 vuelve a fallar. Debería
   ofrecer "Iniciar sesión" en ese caso puntual.
3. **Cerrar el drift de las tablas de admisión** en serio, no solo con el
   parche manual: aislar si de verdad es el ciclo `stop`/`start` de Supabase
   CLI, o mover esas dos tablas al sistema de migraciones de Supabase
   (`supabase/migrations/`) si resulta que ahí sí sobreviven.
4. **Recorrido en navegador real** de todo lo construido a partir del reporte
   de "commitea" de contraseña temporal en adelante — nadie lo vio renderizado
   todavía, solo verificado por código.
5. Con menor urgencia: desambiguación con más contexto que un nombre pelado
   cuando hay varios candidatos, y una señal de progreso durante la espera del
   chat en vez de un solo texto fijo.

El punto 1 es el que más cambia lo que un usuario real siente al usarlo todos
los días; los puntos 2 y 4 son los que evitan que un problema chico se sienta
como que "el sistema está roto".
