# Handoff: Migración faq-agent → clinical-agent

**Fecha:** 2026-06-22  
**Repo activo:** `c:\git_root\clinical-agent`  
**Repo legacy (referencia):** `c:\git_root\faq-agent`  
**Plan maestro:** `c:\Users\corps\.cursor\plans\migración_clinical-agent_sdd_a5bb742b.plan.md`

---

## Objetivo del proyecto

Migrar el agente clínico de `faq-agent` a un repo limpio `clinical-agent` con **app Next.js unificada** (chat + Payload admin + Local API), Neon Postgres, pipeline extractor→JSON→MCP loader, y catálogo clínico modelado desde el ERD.

---

## Qué se decidió (grill-me)

| Tema | Decisión |
|------|----------|
| Repo | Nuevo `clinical-agent`, scaffold en raíz preservando docs existentes |
| Arquitectura | App unificada (no monorepo dual faq-agent) |
| Stack | Next 16.2.x, React 19, Payload 3.85+, Neon Postgres |
| Skills | Instaladas manualmente en `.agent/skills/` + `.claude/skills/` |
| Prisma chat | Incluir en SDD-1E (misma Neon DB, tablas distintas a Payload) |
| Schema SDD-2 | Desde `faq-agent/docs/erd_dominio_clinico.mmd`, **no** copiar `Products.ts` tal cual |
| Presentaciones | Híbrido: array `presentaciones[]` embebido + join fields Payload |
| Combinaciones efectivas | Diferidas (post-MVP) |
| Extractor pipeline | JSON local (`tmp/migration/extracted/`) → loader MCP (2 pasos) |
| validationStatus default | `PENDING`; gaps clínicos → `NEEDS_CLINICAL_REVIEW` |

---

## Estado actual de SDD-1 (`clinical-platform-scaffold`)

| Sub-fase | Estado | Notas |
|----------|--------|-------|
| **1A Template** | ✅ Hecho | Payload blank + Postgres, `(frontend)` + `(payload)` |
| **1B Upgrade** | 🟡 Parcial | Versiones OK (Next 16.2.6, Payload 3.85.1). Falta: codemod async APIs, `serverExternalPackages: ['sharp']` en `next.config.ts` |
| **1C Skills/docs** | 🟡 Parcial | Skills en repo. **Falta:** `AGENTS.md`, `openspec/`, copiar `docs/erd_dominio_clinico.mmd`, `CONTEXT.md` |
| **1D Infra/BD** | 🟡 Casi listo | Ver abajo |
| **1E Prisma** | ❌ Pendiente | Sin `prisma/`; tablas chat fueron eliminadas en el drop |

### Limpieza BD (completada en sesión)

Agente Sonnet 4.6 ejecutó reset total del schema `public` en Neon:

- **Antes:** 24 tablas (legacy faq-agent/cms: `categories`, `products`, `payload_users`, + chat `sessions`/`messages`/`feedbacks`)
- **Después:** 9 tablas template (`users`, `users_sessions`, `media` + internals Payload)
- **Migración:** `src/migrations/20260622_234535_init_payload.ts`
- **Scripts:** `pnpm db:list`, `db:drop`, `db:migrate:create`, `db:migrate`
- **`.env.example`:** corregido a Postgres
- **`payload.config.ts`:** `push: false`
- **`pnpm build`:** pasó

### Pendiente en 1D

- Cablear `@payloadcms/plugin-mcp` en `payload.config.ts` (dep ya instalada, `plugins: []` vacío)
- `setup-mcp-api-key.ts` + documentar `PAYLOAD_MCP_API_KEY` en `.env.example`
- Verificar `pnpm dev` → `/admin` con usuario admin

---

## SDD globales (6 flujos)

1. **SDD-1** scaffold (1A–1E) — **en curso**
2. **SDD-2** `payload-clinical-schema` — colecciones desde ERD ← **siguiente bloque principal**
3. **SDD-3** taxonomy-seed
4. **SDD-4** product-extractor-local
5. **SDD-5** payload-loader-mcp
6. **SDD-6** agent-payload-tools (Local API, reemplazar `registry.json`)

Revisión clínica Dra. Sara = operación humana entre SDD-5 y SDD-6.

---

## Archivos clave

| Path | Rol |
|------|-----|
| `clinical-agent/src/payload.config.ts` | Config Payload (solo users + media hoy) |
| `clinical-agent/src/scripts/*.ts` | list/drop/migrate DB |
| `clinical-agent/package.json` | scripts `db:*` |
| `faq-agent/docs/erd_dominio_clinico.mmd` | Fuente schema SDD-2 |
| `faq-agent/apps/cms/src/collections/` | Referencia UX/campos (no copiar 1:1) |
| `faq-agent/cuestionario_diseno_extractor.md` | Reglas extractor |
| `faq-agent/tareas_migracion_dev_jr.md` | Tareas junior extractor/cargador |
| `faq-agent/PLAN_MIGRACION.md` | Plan original 6 fases |

---

## Comandos útiles

```powershell
cd c:\git_root\clinical-agent
pnpm db:list
pnpm db:drop          # solo dev — reset total
pnpm db:migrate:create
pnpm db:migrate
pnpm generate:types
pnpm dev              # /admin
pnpm build
```

---

## Riesgos / gotchas

- `db:drop` borra **todo** el schema public (incl. futuras tablas Prisma hasta que se re-migren).
- Payload admin users = slug `users` (template); faq-agent usaba `payload-users`.
- No commitear `.env` (contiene `DATABASE_URL`, `PAYLOAD_SECRET`).
- SDD-2 debe generar **nueva** migración; no reutilizar migrations de faq-agent/cms.

---

## Siguiente sesión — orden sugerido

1. Cerrar restos SDD-1: MCP plugin, codemod async (1B), copiar docs (1C), Prisma (1E) — o saltar Prisma si el foco es solo schema.
2. `/sdd-init payload-clinical-schema` + `/grill-me` SDD-2 contra ERD.
3. Implementar colecciones maestras + `products` con `validationStatus`, `presentaciones[]` híbrido.
4. `pnpm db:migrate:create` + `pnpm db:migrate` + `pnpm generate:types`.

---

## Suggested skills

Invocar al retomar:

| Skill | Cuándo |
|-------|--------|
| `grill-me` | Diseño SDD-2 colecciones (una pregunta a la vez) |
| `grill-with-docs` | Alinear términos con `CONTEXT.md` durante SDD-2 |
| `payload` (`clinical-agent/.agent/skills/payload/SKILL.md`) | Definir colecciones, hooks, relaciones, MCP |
| `next-best-practices` | Codemod async APIs, bundling sharp |
| `neon-postgres` | Branches Neon si se necesita DB paralela |
| `tdd` | Tests al implementar colecciones |
| `extract-product` | SDD-4 (adaptar paths a clinical-agent) |
| `clinical-resolver` | Revisión clínica post-carga |

Ciclo SDD OpenSpec (si aplica): `sdd-init` → `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-tasks` → `sdd-apply` → `sdd-verify` → `sdd-archive`

---

## Sensibles (redactados)

- `.env` en `clinical-agent` tiene credenciales Neon y `PAYLOAD_SECRET` — no leer ni commitear.
- Regenerar admin user en `/admin` tras el drop si no existe sesión.
