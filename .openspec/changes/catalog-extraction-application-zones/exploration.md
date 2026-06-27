# Exploration: Application Zones Extraction

## Current State

The `application-zones` Payload CMS collection **already exists** in the project as a simple flat lookup table:

- **File:** `src/collections/ApplicationZones.ts` (16 lines)
- **Schema:** `{ name: text, required: true }` — no relationships, no aliases, no taxonomy fields
- **Admin group:** `Catálogos`
- **Wired in:** `src/payload.config.ts:13,37`
- **MCP plugin:** create/update/find enabled, delete disabled (per `src/payload.config.ts:65`)
- **Pattern precedent:** mirrors `ActiveIngredients` and `AdministrationRoutes` — three flat lookup collections with the exact same shape, suggesting a "catalog of normalized terms" pattern.

The collection is **empty** (no rows seeded). Clinical datasheets live in two Markdown corpora on disk:

| Corpus | Path | Count | Purpose |
|--------|------|-------|---------|
| Category guides | `catalogs/*.md` (root) | 14 | One file per clinical category (rellenos, toxinas, enzimas, hilos, etc.) |
| Category index mirrors | `catalogs/indices/*.md` | 15 | Cleaner structured versions of the same categories, includes clinical warnings |
| Product datasheets | `real-products/*.md` | 64 | One file per SKU (HYALURONIDASE, ULTRA CA+, etc.) |

Domain glossary (`CONTEXT.md` line 56-58) gives the canonical definition: **"Zona de Aplicación: Región anatómica específica del cuerpo (como ojeras, labios, pómulos o abdomen) donde se realiza la intervención y que determina el protocolo clínico y las medidas de seguridad."** — and forbids "Área, región, parte del cuerpo" as synonyms.

There are **no existing extraction scripts** in the repo — `src/scripts/` only contains DB migration helpers (`run-migrate.ts`, `run-migrate-create.ts`, `list-db-tables.ts`, `drop-payload-tables.ts`).

## Affected Areas

- `src/collections/ApplicationZones.ts` — collection definition (already exists, no schema change needed unless we want to add a uniqueness constraint)
- `src/payload.config.ts` — already registered, no change needed
- `src/scripts/` — new directory for extraction scripts (e.g., `src/scripts/extract-application-zones.ts` running on Node + the Payload Local API)
- `real-products/*.md` (64 files) — primary source for per-product zones
- `catalogs/indices/*.md` (15 files) — secondary source for zones mentioned in cross-product category guides
- `catalogs/*.md` (root) — duplicate of `indices/`, skip to avoid double-counting
- `CONTEXT.md` — domain glossary, reference for canonical term decisions

## Approaches

### Option A — Manual curation by clinical reviewer (no script)

- **Pros:** Highest clinical accuracy; no code; no infrastructure
- **Cons:** Slow (15-30 min per file × 78 files = 20-40 hours), non-reproducible, doesn't match the "automated extraction + review" pattern implied by the task
- **Effort:** High (time-wise), Low (code-wise)

### Option B — Deterministic Node.js extraction script (regex-based, no LLM)

- **Pros:** Reproducible, idempotent, fast, easy to diff, no API costs, runs offline
- **Cons:** Brittle on compound/procedure names ("Marcaje mandibular" must be hand-mapped to "Mandíbula"); will require a curated synonym table to canonicalize "patas de gallo" / "surco nasogeniano" / etc.
- **Effort:** Medium (script ~200-300 lines + a `synonyms.json` lookup table)

### Option C — LLM-assisted extraction (use the existing `streamText` pipeline or direct OpenAI call)

- **Pros:** Handles natural language variability well; can deal with "Como bioestimulador: frente, sien" patterns
- **Cons:** Non-deterministic, costs money, slower, requires prompt engineering + JSON validation, can hallucinate zones that aren't in the source
- **Effort:** Medium-High (prompt design + validation + cost)

### Option D — Hybrid: deterministic extraction → LLM review pass for ambiguous cases

- **Pros:** Most accurate; deterministic baseline + LLM only where regex can't decide; cheaper than pure LLM
- **Cons:** Two-stage pipeline; more complex; still needs the synonym table
- **Effort:** High

## Recommendation

**Option B (deterministic script) with a small curated synonym table.** Reasons:

1. The data is structured Markdown with predictable section headers — not free-form prose. Regex is sufficient.
2. The MCP plugin is already configured to allow creates against `application-zones` with no human-in-loop requirement for the payload write.
3. Determinism > cleverness here — the final list of ~30-50 canonical zone names will be stable for months, and we want zero false-positive hallucinated zones.
4. A synonym table (e.g., `"patas de gallo" → "Patas de gallo"`, `"surco nasogeniano" → "Surco nasogeniano"`, `"marcaje mandibular" → "Mandíbula"`) is a flat JSON file the clinical director can edit without touching code.
5. The script can output the strict `{ slug, data: [{name}] }` JSON and then call `payload.create()` per row, checking for `name` collision first to be idempotent.

**Reserved judgment for the proposal/spec phase:**
- Whether to skip `Rostro` (face as a whole) and `Cuerpo` (body as a whole) — task says "concrete anatomical zones", and `Rostro` is a region not a zone. Recommend skip, but flag for clinical confirmation.
- Whether `Cuello` (neck) counts as concrete enough — yes, it appears in CONTEXT.md glossary examples, so include.
- Whether `Zona periorbitaria` and `Ojera` should coexist or merge — recommend `Ojera` only (the glossary uses this term).

## Risks

- **Rostro/Cuerpo pollution** — many datasheets list "Rostro" or "Cuerpo" as the only zone, but these are regions, not specific zones. The synonym table MUST treat these as "skip" tokens, not as canonical names.
- **Procedure names hiding zones** — "Marcaje mandibular", "Foxy eyes", "Rinomodelación", "Lifting facial" are procedure names that contain zone references. A naive split-on-comma will produce these as garbage zone names. Need explicit procedure-name → zone mapping.
- **Indications field contamination** — ULTRA CA+ lists "Indicaciones: Bioestimulador de colágeno. Voluminizador. Marcaje mandibular, mentón, nariz" — the `Marcaje mandibular, mentón, nariz` portion is zones, but "Bioestimulador de colágeno" / "Voluminizador" are effects and must be filtered. The extraction must scan ONLY the `**Zonas de aplicación:**` section, not the `**Indicaciones:**` section.
- **Empty placeholder sections** — `real-products/HYALURONIDASE.md` and `real-products/LIPASE.md` have `## ZONAS DE APLICACIÓN:` followed by a blank line and then `## FRECUENCIA:`. The script must detect "section exists but is empty" and skip.
- **Accent and case normalization** — source files mix `técnica TPS`, `pómulos`, `Pómulos` across files. Normalize to Title Case + strip diacritics only for matching, then re-apply Title Case with diacritics for display.
- **Singular vs plural** — task says "Write names in singular with first letter capitalized (e.g., 'Labios' or 'Labio')". Pick singular: `Labio`, `Ojo`, `Ceja`, `Mejilla`, `Pómulo`, `Mama`, `Glúteo`, `Muslo`, `Brazo`, `Axila`, `Ingle`. The glossary example uses "pómulos" (plural) but the task explicitly says singular, so the task wins.
- **Idempotency** — MCP plugin allows create but not delete. If the script runs twice, we need `payload.find({ collection: 'application-zones', where: { name: { equals: zoneName } } })` before each create to avoid 409s.
- **Cross-source duplicates** — a zone like "Mentón" may appear in 12 files. The script must dedupe by canonical name, not by file.

## Ready for Proposal

**Yes.** The exploration gives the orchestrator enough to launch a `sdd-propose` phase that writes:

1. `proposal.md` — intent (extract + dedupe + normalize + upsert canonical zone names), scope (78 source files, 1 Payload collection), approach (Option B: deterministic script + synonym table)
2. `specs/application-zones.md` — requirements: deterministic output, idempotent upsert, skip regions, singular Title Case, no semantic duplicates
3. `design.md` (or inline in proposal) — file layout: `src/scripts/extract-application-zones.ts` + `src/scripts/synonyms.json` + the `name` field stays as the only schema field on `ApplicationZones`
4. `tasks.md` — 1) build synonym table from sample extraction, 2) implement regex extractor, 3) add idempotency check, 4) dry-run output for clinical review, 5) real run + verify with Payload find

The orchestrator should tell the user: "Exploration complete. The collection already exists and is empty. The proposed approach is a deterministic Node script (Option B) with a curated synonym table. We will skip regions like `Rostro`/`Cuerpo` and merge `Ojera`/`Zona periorbitaria` into a single canonical `Ojera`. Ready to draft the formal proposal?"

## Search patterns observed in source files

For the spec phase, these are the actual regex patterns the extractor will target:

```
^##\s+ZONAS\s+DE\s+APLICACI[OÓ]N:?\s*$
^###\s+ZONAS\s+DE\s+APLICACI[OÓ]N:?\s*$
^\*\s+\*\*Zonas\s+de\s+aplicaci[oó]n(?:\s*\([^)]*\))?:\*\*\s*
```

Body extraction after a matched header: read lines until the next `##`/`###`/`* **` block, then split on `,` / `y` / `;`, strip wrappers (`*`, `-`, leading/trailing whitespace), and run each token through the synonym + normalization table.
