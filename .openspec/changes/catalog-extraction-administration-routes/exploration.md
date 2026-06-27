# SDD Explore: Administration Routes Collection Extraction

## Current State

The `administration-routes` Payload CMS collection **already exists** and is registered. No schema work is required — this is a pure data-extraction task.

- **Collection:** `src/collections/AdministrationRoutes.ts` — single `name: text` (required), `useAsTitle: 'name'`, group `Catálogos`. Shape mirrors `ApplicationZones`, `ActiveIngredients`, `ApplicationTechniques` (the project's established "flat normalized catalog" pattern).
- **Registered in:** `src/payload.config.ts` (line 14, line 38).
- **MCP enabled:** `find`, `create`, `update` for `administration-routes` (line 66 of payload.config.ts).
- **Already referenced by** `Protocols.route` (relationship, required) at `src/collections/Protocols.ts:22-27` — confirmed by foreign key in `src/migrations/20260623_012334_init_payload.ts:187`. So the consumer of this catalog already exists in the schema.
- **No existing extraction scripts**. `src/scripts/` only contains DB-migration helpers (`run-migrate.ts`, `run-migrate-create.ts`, `list-db-tables.ts`, `drop-payload-tables.ts`).
- **Precedent changes** that this mirrors:
  - `openspec/changes/catalog-extraction-laboratories/` — 11 labs, deterministic regex script
  - `openspec/changes/catalog-extraction-application-zones/` — 78 files, deterministic script + synonym JSON
  - `openspec/changes/catalog-extraction-active-ingredients/` — 78 files, deterministic + acronym JSON

## Data Source Survey

Injection depth / route information lives in **two Markdown corpora** plus a single structured index mirror. The `catalogs/*.md` root files and `catalogs/indices/*.md` are near-duplicates — pick the `indices/` for cleaner structure.

| Corpus | Path | Files with route info | Notes |
|--------|------|----------------------|-------|
| Category index mirrors | `catalogs/indices/*.md` | 11 of 15 | Cleanest source — has explicit `**Vía:**` / `**Profundidad:**` / `**Plano de aplicación:**` / `**Nivel de aplicación:**` fields |
| Category guides | `catalogs/*.md` | 11 of 13 | Same content, less normalized — `**Profundidad de aplicación:**`, `Aplicación:` headers |
| Product datasheets | `real-products/*.md` | 8 of 64 | Sparse — only fillers (CELOSOME, SOFIDERM, ULTRAFILL, WIZFILL, ULTRA HILO, CELOSOME-XSHAPE) and bioestimulators (ULTRA CA+, REJUBELLA) carry structured `PROFUNDIDAD` sections |

**Critical corpus mapping** (which file uses which field label):

| Field label (exact) | Files where it appears |
|---------------------|------------------------|
| `**Profundidad de la inyección:**` | `catalogs/rellenos.md`, `catalogs/indice.md` (Sofiderm Derm/Fine/Deep, WIZFILL) |
| `**PROFUNDIDAD DE INYECCIÓN**` (table cell) | `catalogs/rellenos.md`, `catalogs/indice.md` (ULTRAFILL Fine/Deep/Kiss/Nose table) |
| `### PROFUNDIDAD:` / `**PROFUNDIDAD:**` | `real-products/CELOSOME.md`, `real-products/SOFIDERM 1ml.md`, `real-products/SOFIDERM 2ml.md`, `real-products/SOFIDERM SKIN BOOSTER.md`, `real-products/ULTRAFILL.md`, `real-products/WIZFILL PLUS.md` |
| `### Profundidad de aplicación:` | `catalogs/Bioestimuladores, biorevitalizador, exosomas.md` (ULTRA CA+, REJUBELLA) |
| `* Profundidad: Dermis Profunda.` (inline bullet) | `real-products/ULTRA HILO.md` |
| `*   **Profundidad de la inyección:** Tejido celular subcutáneo.` | `real-products/CELOSOME-XSHAPE.md` |
| `**Aplicación:** Intravenosa.` | `catalogs/regenerativos.md`, `catalogs/indices/regenerativos.md` (LAURETH) |
| `*   Profundidad: Intramuscular.` | `catalogs/toxinas.md` (botulinum toxins) |
| `*   Aplicación: Intradérmica (mesoterapia o dermapen).` | `catalogs/despigmentantes.md`, `catalogs/hidratantes.md`, `catalogs/capilar.md` |
| `**Aplicación:** Intradérmica (mesoterapia o dermapen).` | `catalogs/regenerativos.md` (AEC, B-Complex, Vitamina C, etc.) |
| `**Aplicación:** Intravenosa.` | `catalogs/regenerativos.md` (LAURETH) |
| `*   Aplicación: A nivel de tejido adiposo.` | `catalogs/Lipolíticos.md` (L-Carnitina, Phosphatidylcoline, Deoxycholic 10%, LIPOFIRMING, Artichoke, Cellulite) |
| `Aplicación: Tejido adiposo / Intradérmico.` | `catalogs/Lipolíticos.md` (Caffeine, Fat Burner) |
| `Aplicación: Tejido adiposo/ Intradérmico.` | `catalogs/Lipolíticos.md` (Fat Burner — note no space) |
| `**Nivel de aplicación:** Subcutáneo / Tejido adiposo / Tejido graso` | `catalogs/Lipolíticos.md` (header) |
| `* **Plano de aplicación:** Intradérmico` | `catalogs/indices/Hilos PDO.md` (MONO) |
| `* **Plano de aplicación:** Subdérmico` | `catalogs/indices/Hilos PDO.md` (COG 6D) |
| `* **Vía:** Intradérmica (mesoterapia o dermapen)` | `catalogs/indices/*.md` (despigmentantes, capilar, hidratantes) |
| `* **Vía:** Tejido adiposo / Intradérmico` | `catalogs/indices/Lipolíticos.md` |
| `* **Vía:** **Intravenosa** (Escleroterapia)` | `catalogs/indices/regenerativos.md` (LAURETH) |
| `**Nivel de aplicación:** Intradérmico.` | `catalogs/regenerativos.md` (REJUBELLA direct reference) |
| `Profundidad de inyección: 6 mm a 8 mm` (mm) | `catalogs/enzimas.md` (facial) — **NOT a tissue route, skip** |
| `Profundidad de inyección: 8 a 12 mm` (mm) | `catalogs/enzimas.md` (corporal) — **NOT a tissue route, skip** |
| `Aplicación: Lifting facial, cuello y escote.` | `real-products/HILOS PDO.md` (TORNADO) — **NOT a depth, this is indication/zone — skip** |

## Distinct Tissue / Route Terms Found in Source

After surveying the entire corpus, the following distinct terms (after stripping punctuation/whitespace) were observed:

**Dermis variants (fillers):**
- `Dermis superficial` (WIZFILL No.1, CELOSOME Soft standalone)
- `Dermis media` (WIZFILL No.1, ULTRAFILL Fine, CELOSOME Mid standalone, SOFIDERM FINE LINES standalone, SOFIDERM SKIN BOOSTER standalone)
- `Dermis profunda` (CELOSOME STRONG, ULTRA HILO, ULTRA CA+, Rejubella)
- `Dermis` (ULTRAFILL table — generic)
- `Superficial a dermis media` (Celosome Soft table — compound range)
- `Dermis superficial-media` (CELOSOME Soft header — compound range, hyphen variant)
- `Dermis media, subcutánea` (Sofiderm Derm catalog — comma atomization)
- `Dermis media a profunda` (CELOSOME Mid, ULTRAFILL DEEP, SOFIDERM DERM, WIZFILL No.2 — range)
- `Dermis media -profunda` (CELOSOME Mid — hyphen variant)
- `Dermis superficial a dermis media` (WIZFILL No.2 catalog — range)
- `Dermis superficial a media` (WIZFILL No.2 catalog)
- `Dermis profunda, subcutáneo, periostio` (WIZFILL No.3 — comma atomization)

**Subcutaneous variants:**
- `Tejido celular subcutáneo` (CELOSOME STRONG, CELOSOME-XSHAPE, Rejubella, ULTRA CA+)
- `Tejido subcutáneo` (CELOSOME, SOFIDERM 2ml Derm Sub-Skin)
- `Tejido subcutáneo a periostio` (SOFIDERM 1ml, SOFIDERM 2ml DEEP, ULTRAFILL SHAPE, WIZFILL No.3 — range to periosteum)
- `Tejido subcutáneo a Periostio` (capital P variant)
- `Tejido subcutáneo superficial` (CELOSOME IMPLANT)
- `Subcutáneo` (ULTRAFILL KISS/NOSE table, Lipolíticos)
- `Subcutánea` (Sofiderm Derm — feminine adjective)
- `Subcutáneo profundo` (ULTRAFILL SHAPE table)
- `Subcutáneo, periostio` (Sofiderm Deep catalog — compound)
- `Capa subcutánea` (CELOSOME STRONG table)
- `Capa subcutánea superficial` (ULTRA HILO cuello protocol)
- `Capa de grasa` (LIPOLAB — fat-layer synonym)
- `Subcutaneous tissue` (LIPOLAB English)
- `Subcutaneous Injection` (LIPOLAB English header)

**Periosteum / bone:**
- `Periostio` (CELOSOME IMPLANT, ULTRA CA+, WIZFILL No.3)

**Intradermal / surface:**
- `Intradérmico` (Hilos MONO, despigmentantes indices, Lipolíticos Caffeine/Fat Burner)
- `Intradérmica` (feminine — despigmentantes, hidratantes, capilar, regenerativos)
- `Intradermal` (English — does not appear)
- `Intradérmico / Tejido celular subcutáneo superficial` (Rejubella compound)
- `Intradérmica / Tejido adiposo` (Silicio Orgánico — compound)

**Adipose tissue:**
- `Tejido adiposo` (Lipolíticos indices, Otros productos)
- `Tejido graso` (Lipolíticos header — synonym)

**Systemic routes:**
- `Intramuscular` (toxinas)
- `Intravenosa` / `IV` (LAURETH, escleroterapia)

**Other / non-route (must FILTER OUT):**
- `Mesoterapia` (TECHNIQUE, not a route — appears in every mesoterapia catalog as a delivery method)
- `Dermapen` (TECHNIQUE, not a route)
- `Lifting facial, cuello y escote` (HILOS PDO TORNADO — INDICATION, not a route)
- `Lifting ligero, arrugas profundas, producción de colágeno` (HILOS PDO TORNADO catalog — INDICATION)
- `A nivel de tejido adiposo` (LIPOLÍTICOS — phrasing, normalizes to `Tejido adiposo`)
- `Inyectado en tejido subcutáneo:` (LIPOLÍTICOS — context prose, normalizes to `Tejido celular subcutáneo`)
- `6 mm a 8 mm` / `8 a 12 mm` / `2-4 mm` (ENZIMAS — depth in millimeters, NOT a tissue layer; the same products are tagged `Mesoterapia` which is a technique)
- `Aplicación casi indolora, no requiere de anestesia` (ULTRA HILO — descriptor)
- `0,2 ml por punción` (dosage, not a route)
- `Subcutaneous` (English — normalizes to `Subcutáneo`)

## Normalization Decisions (canonical list)

After applying atomization + normalization rules, the consolidated canonical list is:

| # | Canonical term | Normalizes these raw terms |
|---|----------------|---------------------------|
| 1 | **Dermis superficial** | `Dermis superficial` (alone) |
| 2 | **Dermis media** | `Dermis media` (alone) |
| 3 | **Dermis profunda** | `Dermis profunda` (alone) |
| 4 | **Intradérmico** | `Intradérmico`, `Intradérmica` (gender-normalized) |
| 5 | **Intramuscular** | `Intramuscular` |
| 6 | **Intravenosa** | `Intravenosa`, `IV` |
| 7 | **Periostio** | `Periostio` (alone) |
| 8 | **Subcutáneo profundo** | `Subcutáneo profundo` (from ULTRAFILL SHAPE table — distinct layer, NOT a synonym of generic subcutáneo) |
| 9 | **Tejido adiposo** | `Tejido adiposo`, `Tejido graso`, `Capa de grasa`, `A nivel de tejido adiposo` |
| 10 | **Tejido celular subcutáneo** | `Subcutáneo`, `Subcutánea` (gender-normalized), `Tejido subcutáneo`, `Capa subcutánea`, `Subcutaneous tissue`, `Inyectado en tejido subcutáneo` |
| 11 | **Tejido celular subcutáneo superficial** | `Tejido subcutáneo superficial`, `Capa subcutánea superficial`, `Subdérmico` (Hilos COG) |

**Atomization applied** (compound ranges split into individual canonical records):
- `Dermis superficial-media` → `Dermis superficial` + `Dermis media`
- `Superficial a dermis media` → `Dermis superficial` + `Dermis media`
- `Dermis superficial a dermis media` → `Dermis superficial` + `Dermis media`
- `Dermis media a profunda` → `Dermis media` + `Dermis profunda`
- `Dermis media -profunda` → `Dermis media` + `Dermis profunda`
- `Dermis media, subcutánea` → `Dermis media` + `Tejido celular subcutáneo`
- `Dermis profunda, subcutáneo, periostio` → `Dermis profunda` + `Tejido celular subcutáneo` + `Periostio`
- `Tejido subcutáneo a periostio` → `Tejido celular subcutáneo` + `Periostio`
- `Subcutáneo, periostio` → `Tejido celular subcutáneo` + `Periostio`
- `Intradérmico / Tejido celular subcutáneo superficial` → `Intradérmico` + `Tejido celular subcutáneo superficial`
- `Intradérmica / Tejido adiposo` → `Intradérmico` + `Tejido adiposo`
- `Subcutáneo / Tejido adiposo / Tejido graso` → `Tejido celular subcutáneo` + `Tejido adiposo`
- `Tejido adiposo / Intradérmico` → `Tejido adiposo` + `Intradérmico`
- `Tejido adiposo/ Intradérmico` → `Tejido adiposo` + `Intradérmico`
- `Dermis media a profunda, capa subcutánea` → `Dermis media` + `Dermis profunda` + `Tejido celular subcutáneo`

**Filter rules** (terms that LOOK like routes but are NOT):
- `Mesoterapia`, `Dermapen` — techniques, not anatomical layers
- `Lifting facial`, `Lifting ligero`, `Arrugas profundas` — indications
- `<N> mm`, `<N> a <N> mm`, `<N>-<N> mm` — depth in millimeters (ENZIMAS only); these products are categorized as mesotherapy which maps to `Intradérmico` if we choose, OR are skipped since the data is layer-less
- `A nivel de tejido adiposo` — phrasing, normalizes to `Tejido adiposo`
- `0,2 ml por punción`, `0.01 - 0.03 ml por punción` — dosage, not route
- `Subcutaneous Injection` (English header in LIPOLAB) — header, not value

## Affected Areas

- `C:\git_root\clinical-agent\src\collections\AdministrationRoutes.ts` — collection already exists, no schema change
- `C:\git_root\clinical-agent\src\payload.config.ts` — already registered + MCP enabled
- `C:\git_root\clinical-agent\real-products\*.md` (8 files with structured `PROFUNDIDAD` sections)
- `C:\git_root\clinical-agent\catalogs\*.md` (11 files) — primary source
- `C:\git_root\clinical-agent\catalogs\indices\*.md` (11 files) — cleaner mirror
- `C:\git_root\clinical-agent\src\scripts\extract-administration-routes.ts` — **new file** (TDD target)
- `C:\git_root\clinical-agent\tests\int\extract-administration-routes.test.ts` — **new file** (regex + cleanup pipeline tests)

## Approaches

### Approach A — Single regex + atomization + normalization pipeline (Recommended)
- One Node/TS script `src/scripts/extract-administration-routes.ts`
- In-memory regex pipeline; no external deps
- Pure functions, fully unit-testable
- Two-table design: a `routes-dictionary.json` (raw → canonical mapping) + a `range-separators.json` (regex for atomizing compound ranges)
- **Pros**: simple, fast, deterministic, easy TDD, mirrors the established `catalog-extraction-laboratories` / `catalog-extraction-application-zones` patterns
- **Cons**: requires writing a careful synonym table
- **Effort**: Low

### Approach B — Use MCP plugin to upsert
- Use the MCP plugin's `create` capability
- **Pros**: zero transport code
- **Cons**: requires MCP server running; harder to test; not idempotent by default; the data volume is small (11 records) — MCP overhead not worth it
- **Effort**: Medium

### Approach C — AI-assisted extraction via the `extract-product` skill
- The skill is referenced in `AGENTS.md:23` but not installed locally (user-level only)
- **Pros**: handles ambiguous cases via LLM
- **Cons**: non-deterministic, slow, expensive, no TDD red-green loop, violates the "concepts > code" principle for what is mechanical regex work
- **Effort**: Medium-High

## Recommendation

**Approach A** — single regex + atomization + normalization pipeline.

Rationale:
1. The data is small (11 canonical records from ~30 source files) and highly structured.
2. The extraction logic is fully deterministic — ideal for TDD.
3. The atomization + synonym pipeline covers every variant observed across the corpus.
4. The two preceding changes (`catalog-extraction-laboratories`, `catalog-extraction-application-zones`) used this same pattern successfully — reuses the mental model and reduces review overhead.
5. Strict TDD mode is ENABLED in the project (per `AGENTS.md`) — Approach A enables a clean red-green-refactor loop.
6. Approach C violates the "concepts > code" principle: we're using AI to do mechanical regex work.

For upsert, query Payload Local API by `name` and `create` only if missing — idempotent and uses Payload's native data layer (no MCP dependency).

## Extracted Result (11 unique routes, JSON)

```json
{
  "slug": "administration-routes",
  "data": [
    { "name": "Dermis superficial" },
    { "name": "Dermis media" },
    { "name": "Dermis profunda" },
    { "name": "Intradérmico" },
    { "name": "Intramuscular" },
    { "name": "Intravenosa" },
    { "name": "Periostio" },
    { "name": "Subcutáneo profundo" },
    { "name": "Tejido adiposo" },
    { "name": "Tejido celular subcutáneo" },
    { "name": "Tejido celular subcutáneo superficial" }
  ]
}
```

Distribution by clinical category:
- **Fillers (rellenos)**: Dermis superficial, Dermis media, Dermis profunda, Tejido celular subcutáneo, Tejido celular subcutáneo superficial, Periostio, Subcutáneo profundo (7 of 11)
- **Mesotherapy cocktails (hidratantes, despigmentantes, capilar, regenerativos)**: Intradérmico (1)
- **Lipolíticos**: Tejido adiposo, Intradérmico (2 of 11)
- **Bioestimuladores**: Dermis profunda, Tejido celular subcutáneo, Tejido celular subcutáneo superficial, Periostio (4 of 11)
- **Hilos PDO**: Tejido celular subcutáneo superficial (= subdérmico), Intradérmico (2 of 11)
- **Skin boosters**: Intradérmico, Dermis media (2 of 11)
- **Toxinas botulínicas**: Intramuscular (1 of 11)
- **Escleroterapia (LAURETH)**: Intravenosa (1 of 11)

## Edge Cases & Risks

1. **"Capa de grasa" vs "Tejido adiposo" vs "Tejido graso"** — all refer to the same anatomical layer. Normalize all to `Tejido adiposo` (the most clinically precise in Spanish medical literature; "tejido graso" is layperson terminology, "capa de grasa" is descriptive prose).

2. **"Subcutáneo" vs "Subcutáneo profundo" vs "Tejido celular subcutáneo"** — these are THREE DISTINCT canonical records. The ULTRAFILL table explicitly differentiates: `Dermis | Subcutáneo | Subcutáneo Profundo`. Do NOT merge them. `Tejido celular subcutáneo` is the generic layer; `Subcutáneo profundo` is a specific sub-zone; `Tejido celular subcutáneo superficial` is yet another specific sub-zone (used for threads and for superficial subcutaneous fat injection).

3. **Gender agreement** — "Subcutáneo" / "Subcutánea" / "Intradérmico" / "Intradérmica" / "Periostio" (invariant) — normalize to the masculine singular canonical form. This is the standard form in Spanish medical literature and matches how the field is used in `INDICACIONES`/`RECOMENDADO PARA` headers.

4. **English drift** — "Subcutaneous tissue" (LIPOLAB), "Intradermal" (none observed but possible). Strip language drift by lowercasing + looking up against a case-insensitive synonym table.

5. **`Profundidad de inyección: 6 mm a 8 mm`** in `catalogs/enzimas.md` is the only depth in **millimeters**. The same products (HYALURONIDASE, COLLAGENASE, LIPASE cocktails) are also categorized as "Mesoterapia" in the catalog headers. **Decision**: skip the mm values (they are not a tissue layer), but the underlying products are mesotherapy = `Intradérmico`. This is a RESOLVED edge case — the mm data does NOT contribute a new route, but the products that use it are already accounted for under `Intradérmico`.

6. **"Aplicación: Lifting facial, cuello y escote"** in `real-products/HILOS PDO.md` (TORNADO) is an **indication** (what to treat), not a depth/route. Do NOT extract. Same for "Lifting ligero, arrugas profundas, producción de colágeno" in the catalog.

7. **"Subdérmico"** in `catalogs/indices/Hilos PDO.md` (COG 6D only) — anatomically refers to the layer just below the dermis, which is the SUPERFICIAL subcutaneous tissue. Normalize to `Tejido celular subcutáneo superficial`.

8. **"Dermis"** as a generic standalone value in ULTRAFILL table — is this `Dermis media`? Looking at ULTRAFILL FINE (the row where this appears): "líneas finas, ojeras, arrugas superficiales" — yes, this is a low-density filler → `Dermis superficial` is the actual layer, but the catalog collapses it to just "Dermis". **Decision**: map generic `Dermis` to `Dermis media` (the most common dermis-layer depth in the corpus for low-density fillers). This is the only place where a single `Dermis` token needs to make a clinical decision — flag for human review.

9. **"Mesoterapia"** is a TECHNIQUE not a route. Filter out. Same for `Dermapen`.

10. **Order of operations matters**: atomize FIRST, then normalize, then dedupe. If you normalize first, "Dermis superficial-media" becomes "Dermis superficial, Dermis media" inside a string, which is harder to split cleanly.

11. **"Hipodermis"** does NOT appear in the corpus. (Checked.) If it ever appears, it's a synonym for `Tejido celular subcutáneo`.

12. **Final list size**: 11 records. Stable set — unlikely to grow as new product datasheets are added (these are the canonical anatomical layers, not evolving product-specific zones).

## Implementation Plan (proposal)

1. **Spec phase** (sdd-spec): write scenarios for header detection, compound-range atomization, synonym normalization, and gender/casing cleanup.
2. **Task phase** (sdd-tasks): break into TDD tasks — regex tests → atomization tests → normalization tests → upsert tests.
3. **Apply phase** (sdd-apply): red-green-refactor for the extraction + idempotent upsert via Payload Local API.
4. **Verify phase** (sdd-verify): run extraction, assert 11 unique records, assert all PROFUNDIDAD/Vía/Aplicación sections were captured, assert no duplicates on second run, assert no record has empty `name`.
5. **Archive phase** (sdd-archive): sync the final canonical list to `openspec/specs/administration-routes/spec.md`.

## Ready for Proposal

**Yes** — the data model is stable, the source is well-understood, the atomization + normalization rules are fully explicit, and the extraction logic is fully deterministic and testable. The orchestrator should:

1. Tell the user the **11 extracted routes** (above) and ask for sign-off.
2. Propose writing the extraction script under TDD with the atomization + synonym + normalization pipeline.
3. Confirm whether to upsert via Payload Local API (recommended) or MCP (alternative).
4. Surface the one ambiguous mapping decision: `Dermis` (standalone in ULTRAFILL table) → `Dermis media` — confirm with clinical director.
5. Confirm the gender agreement convention (masculine singular canonical: `Intradérmico`, `Tejido celular subcutáneo`) — matches Spanish medical literature but flag if the user wants a different form.
