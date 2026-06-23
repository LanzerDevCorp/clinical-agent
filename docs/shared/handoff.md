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

## Estado actual

| SDD | Estado | Notas |
|-----|--------|-------|
| **SDD-1** scaffold (1A–1D) | ✅ Cerrado | Build verde, MCP plugin, serverExternalPackages, docs copiados |
| **SDD-1E** Prisma chat | ⏸ Diferido | Sin `prisma/`; tablas chat pendientes para después de SDD-3 |
| **SDD-2** payload-clinical-schema | ✅ Cerrado | 9 colecciones + products, migración corrida manualmente |
| **SDD-3** taxonomy-seed | ❌ Pendiente | **← SIGUIENTE** |
| **SDD-4** product-extractor-local | ❌ Pendiente | |
| **SDD-5** payload-loader-mcp | ❌ Pendiente | |
| **SDD-6** agent-payload-tools | ❌ Pendiente | |

### SDD-2 — Colecciones implementadas

**Maestras:** `laboratories`, `active-ingredients`, `application-zones`, `administration-routes`, `application-techniques`, `contraindications`, `adverse-effects`, `clinical-notes`, `protocols`

**Principal:** `products` con `presentaciones[]` embebido, `validationStatus (PENDING|NEEDS_CLINICAL_REVIEW|APPROVED)`, aliases, relationships a todas las colecciones maestras.

Migración corrida. `/admin` funcional contra Neon.

## SDD globales (6 flujos)

1. **SDD-1** scaffold (1A–1E) — ✅ (1E diferido)
2. **SDD-2** `payload-clinical-schema` — ✅
3. **SDD-3** taxonomy-seed ← **SIGUIENTE**
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

1. `/sdd-init taxonomy-seed` — scripts seed para `application-zones`, `administration-routes`, `application-techniques`, `laboratories` con datos reales de la Dra. Sara.
2. Definir valores reales de `tipo_producto` (select en `Products.ts`) con la doctora.
3. SDD-1E Prisma chat (opcional — diferir si el foco es catálogo).

## Nota BD

El usuario prefiere correr migraciones manualmente. No ejecutar `pnpm db:migrate:create` ni `pnpm db:migrate` desde el agente.

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
