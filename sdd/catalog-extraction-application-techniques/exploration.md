# Exploration: application-techniques catalog extraction

**Change name**: `catalog-extraction-application-techniques`
**Date**: 2026-06-26
**Artifact store**: engram + filesystem (both)

---

## Current State

The `application-techniques` Payload collection **already exists** with a minimal schema
and is wired into the broader clinical catalog domain. There is no extraction script yet —
the goal of this change is to populate the collection from the markdown datasheets under
`catalogs/` and `real-products/`.

### Existing collection (`src/collections/ApplicationTechniques.ts`)

```ts
export const ApplicationTechniques: CollectionConfig = {
  slug: 'application-techniques',
  admin: { useAsTitle: 'name', group: 'Catálogos' },
  fields: [{ name: 'name', type: 'text', required: true }],
}
```

- Registered in `src/payload.config.ts` (line 15, 39, 67).
- MCP plugin permissions: `find: true`, `create: true`, `update: true`, `delete: false`
  → extraction script must be **idempotent** (create-or-update by name).
- Referenced by `Protocols.technique` relationship (single `text`-name field, no
  relationships to other catalog collections on the technique side).

### Existing payload-types (`src/payload-types.ts`)

The collection is typed (`ApplicationTechnique` interface) and the generated
select types are in place. No schema changes are needed for this change.

---

## Affected Areas

- `src/collections/ApplicationTechniques.ts` — schema already in place; no edits needed.
- `src/payload.config.ts` — no edits needed; the collection is already registered.
- `src/scripts/` — new extraction script will live here
  (proposed path: `src/scripts/extract-application-techniques.ts`).
- `catalogs/**/*.md` and `real-products/**/*.md` — read-only inputs.
- Engram observation `obs-0de1ea85acfa8be8` — persisted findings (this file mirrors them).
- `docs/erd_dominio_clinico.mmd` — should be reviewed during the design phase to confirm
  the relationship cardinality of `Protocols.technique` (currently single, not array).

---

## Data Sources for Technique Names

### Primary sources

1. **Top-level catalogs** (`catalogs/*.md`, 12 files):
   - `Bioestimuladores, biorevitalizador, exosomas.md`
   - `Skin boosters.md`
   - `rellenos.md`
   - `regenerativos.md`
   - `Lipolíticos.md`
   - `toxinas.md`
   - `Hilos PDO.md`
   - `dermapen, agujas, aditamentos.md` / `Dermapen, agujas, aditamentos.md`
   - `despigmentantes.md`
   - `hidratantes.md`
   - `capilar.md`
   - `enzimas.md`
   - `Otros productos.md`
2. **Per-product technical sheets** (`real-products/*.md`, ~58 files) — one per
   product, including the ones that mention `técnica de abanico` (ULTRA CA+.md) and
   `Técnica TPS` (ULTRA HILO.md).
3. **Sub-indices with clinical review notes** (`catalogs/indices/*.md`) — useful for
   cross-referencing the canonical name when a catalog has typos
   (e.g. `dudas_modelado.md`, `reporte_dudas.md`).
4. **Quick answers guide** (`guia_respuestas_rapidas.md`) at the repo root.

### Pattern markers in the corpus

| Marker (literal in source)                                    | Example location                                 |
| ------------------------------------------------------------- | ------------------------------------------------ |
| `## PROTOCOLO DE APLICACIÓN`                                  | `real-products/ULTRA CA+.md` line 55             |
| `## TÉCNICA TPS` / `### LA TECNICA TPS:` / `técnica TPS`     | `catalogs/Bioestimuladores, biorevitalizador, exosomas.md` line 173 |
| `**Técnica de aplicación:** Mesoterapia`                      | `catalogs/Lipolíticos.md` line 982               |
| `siguiendo la técnica de abanico`                             | `real-products/ULTRA CA+.md` lines 63, 65        |
| `(técnica de abanico)`                                        | `real-products/ULTRA CA+.md` line 65             |
| `Microneedling (la técnica de preferencia del cliente)`       | `catalogs/regenerativos.md`                      |
| `técnica de inyección permite enfocar...`                     | `catalogs/indice.md` line 154                    |
| `técnica de preferencia del aplicador`                        | `real-products/ULTRA CA+.md` line 71             |

The last marker is **generic filler** and must be filtered out (it is not a named
technique).

---

## Reference Techniques Found (raw → normalized)

| Raw text in corpus                            | Normalized name        | Notes                                |
| --------------------------------------------- | ---------------------- | ------------------------------------ |
| `técnica de abanico`                          | `Técnica de abanico`   | Most frequent; 4+ mentions           |
| `TÉCNICA TPS` / `LA TECNICA TPS:` / `TPS`     | `Técnica TPS`          | Acronym; expansion unknown — keep    |
| `técnica TPS`                                 | `Técnica TPS`          | Same canonical                       |
| `Técnica de aplicación: Mesoterapia`          | `Mesoterapia`          | Only when standalone, not parenthetical to a route |
| `Microneedling (la técnica de preferencia...)`| `Microneedling`        | Used as a named technique in skin boosters/regenerativos |
| `Bolos`                                       | `Bolos`                | Small deposit maneuver; used as a technique verb (e.g. "formar bolos") |

The brief explicitly allows for these to expand as the catalog is mined further
(`Técnica de vectores`, `Barrido lineal`, `Retroinyección`, `Micro-punciones` are all
common in the broader aesthetic medicine literature and may appear).

---

## Noise Exclusion Rules (MUST be applied in order)

1. **Gauges (SUPPLY → drop)**: any term containing a needle/cannula gauge token must be
   discarded. Regex anchor: `\d+G(-\d+)?(mm|cm)?` or `Cánula 25G-50mm`, `Aguja 30G-13 mm`.
2. **Depths / routes (ROUTE → drop, belongs in `administration-routes`)**:
   `Intradérmico`, `Intradérmica`, `Subcutáneo`, `Subcutánea`, `Dermis superficial`,
   `Dermis media`, `Dermis profunda`, `Periostio`, `Tejido adiposo`, `Tejido graso`,
   `Tejido celular subcutáneo`, `Hipodermis`, `Epidermis`.
3. **Doses / frequencies / quantities (drop)**: numeric values followed by `ml`, `cm`,
   `veces por`, `cada N (días|semanas|meses)`, `sesiones`.
4. **Results / states (drop)**: `pápula`, `papulita`, `pápulas`, `equimosis`,
   `hematoma`, `edema`.
5. **Generic filler (drop)**: phrases starting with `Técnica de preferencia del
   aplicador` or `Técnica de preferencia del cliente`.
6. **Hilo PDO product types (drop, belong in `products` not `techniques`)**:
   `Mono`, `Tornado`, `COG`, `Cog`, `Screw Thread`, `Tornado Thread`.
7. **Product / treatment names (drop, NOT techniques)**: `BB Glow`, `Hilos PDO`,
   `Mesoterapia` ONLY when used as a synonym for `Intradérmica`
   (e.g. `Intradérmica (mesoterapia o dermapen)` — here `mesoterapia` is the route).

---

## Normalization Rules

1. Lowercase the candidate string.
2. Strip leading articles (`la`, `el`, `los`, `las`).
3. Strip trailing parenthetical content `(...content...)`.
4. Strip any token matching the gauge regex from step 1 of noise exclusion.
5. **Title-case the first character** of the result (only the first letter; do NOT
   title-case the rest). The rest of the string keeps its source casing
   (acronyms like `TPS` stay uppercase, `Mesoterapia` stays as-is, etc.).
6. If the canonical form is `Técnica de <X>`, **keep the `Técnica de` prefix** —
   the brief examples (`Técnica de abanico`, `Técnica de vectores`) confirm this.
7. If the canonical form is a bare noun (`Mesoterapia`, `Microneedling`, `Bolos`),
   do NOT prepend `Técnica de`.
8. Dedupe case-insensitively and accent-insensitively. The final list must be unique
   and present-tense canonical.

---

## Approaches

### Option A — Single-pass Node/TS script (RECOMMENDED)

- Read all `catalogs/**/*.md` + `real-products/**/*.md` + `guia_respuestas_rapidas.md`.
- Two-phase pipeline: **extract candidates** (positive regex matchers) →
  **filter noise** (the 7 rules above) → **normalize** → **dedupe**.
- Write to Payload via the **local API** (`payload.create` / `payload.update`),
  NOT the MCP, to avoid coupling to MCP availability and to support a proper
  transactional diff.
- Idempotent: before each write, query by name (case-insensitive); create if absent,
  update if normalization changed it. Skip the noise that can't be classified —
  log to stderr for human triage.

- Pros: testable, deterministic, no LLM dependency, idempotent, runs in CI.
- Cons: pattern-based, may miss novel phrasing.
- Effort: **Low**.

### Option B — LLM-assisted extraction

- Send each markdown file to the AI SDK with a structured-output schema
  (`{ techniques: [{ name }] }`).
- De-duplicate with a deterministic post-process.

- Pros: handles free-form prose, finds novel terms.
- Cons: non-deterministic, costs tokens, hallucination risk, not idempotent without a
  review loop. The `clinical-resolver` skill already provides an interactive review path,
  but it would have to be wired into the script.
- Effort: **Medium-High**.

### Option C — Hybrid (script for the easy ones + LLM for the long tail)

- Run A first; for any markdown section that mentions `técnica` but doesn't match a
  known positive pattern, send only that section to the LLM with a strict system
  prompt: "Extract named application techniques. Drop supplies, depths, doses,
  generic phrases. Output JSON."

- Pros: balances determinism with recall.
- Cons: more moving parts; needs a confidence threshold to know when to trust the LLM
  output.
- Effort: **Medium**.

---

## Recommendation

**Option A** — a deterministic, regex-driven Node/TS script at
`src/scripts/extract-application-techniques.ts`. The corpus is small (~70 markdown
files, ~5 MB total), the positive patterns are well-defined, and the noise filters
are straightforward. The user has already pre-classified the noise (`Cánula 25G-50mm`,
`Intradérmico`) in the change brief, so a regex pipeline will be ~100% reliable on
the known terms.

**Fallback**: if the post-extraction list feels short (fewer than ~8 unique techniques),
promote to **Option C** to capture the long tail.

**Why not B**: the brief is a *catalog* extraction, not a knowledge-mining exercise.
LLM determinism is too poor for a canonical list that downstream `Protocols` records
will reference by exact name.

---

## Risks

- **Bolos / Mesoterapia ambiguity** — both are used as a delivery approach and as
  a technique noun. Resolved by the parenthetical-vs-standalone rule, but if the rule
  is mis-applied we will either over-include (noisy) or under-include (incomplete).
- **Acronym `TPS`** — the corpus never expands it. Keep the acronym; do NOT guess an
  expansion. If the clinical director later asks for `Técnica de Puntos de Soporte`
  we will need a follow-up change, not silent renaming.
- **Casing drift** — `TÉCNICA` (all caps) vs `técnica` (lowercase) vs `Técnica` (title).
  The normalizer must lowercase-then-title-case-first, but the rest of the word
  (`TPS`, `Mesoterapia`) must keep its source casing.
- **MCP delete is disabled** — if a noisy term slips into the DB it cannot be deleted
  by the script. The local-API upsert path can still `update` the name, but a
  pre-flight diff is mandatory.
- **Hidden duplicates across accents** — `Técnica` vs `Tecnica`, `Mesoterapia` vs
  `mesoterapia` — normalize via `String.prototype.normalize('NFD').replace(/\p{Diacritic}/gu, '')`
  before comparison.
- **`product-name-map.ts`** — this file maps product aliases; some aliases may
  collide with technique candidates (e.g. `Cog`, `Tornado`). Cross-check before
  publishing the final list.

---

## Pre-Proposal Checklist (for the orchestrator)

- [ ] Confirm the change is **populate-only** (no schema edits required).
- [ ] Confirm idempotency is acceptable: `update` is enabled, `delete` is not.
- [ ] Decide whether `Mesoterapia` is canonical (the corpus treats it as a technique
      in some products and as a synonym for `intradérmica` in others).
- [ ] Decide whether the output JSON is also written to disk as a deliverable
      (recommended: yes, at `sdd/catalog-extraction-application-techniques/seed.json`).
- [ ] Confirm the upsert path (Local API vs Payload MCP). Local API is preferred for
      CI and for transactional control; MCP is preferred for the interactive
      `extract-product` style of operator workflow.

---

## Ready for Proposal

**YES** — the change is well-scoped, the data model already exists, the noise filters
are explicit, and the extraction approach is a low-complexity deterministic script.

Recommended next phase: `sdd-propose` with a one-task plan:
1. Implement `src/scripts/extract-application-techniques.ts` (idempotent local API upsert).
2. Add unit tests for the noise filter and the normalizer.
3. Run the script in dry-run mode and emit `seed.json` for human review.
4. Apply with verification (count of created vs updated records; check no
   `administration-routes` or `products` names leaked into the list).
