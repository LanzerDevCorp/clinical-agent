# Exploration: Active Ingredients Extraction

## Current State

The `active-ingredients` Payload CMS collection **already exists** as a flat lookup table, identical in shape to `application-zones`:

- **File:** `src/collections/ActiveIngredients.ts` (16 lines)
- **Schema:** `{ name: text, required: true }` — no relationships, no aliases, no taxonomy fields, no uniqueness constraint
- **Admin group:** `Catálogos`, `useAsTitle: 'name'`
- **Wired in:** `src/payload.config.ts:12,36` and referenced by `Products.ts:61-66` as a `hasMany: true` relationship on the `activeIngredients` field of every product
- **MCP plugin:** create/update/find enabled, delete disabled (`src/payload.config.ts:64`) — the upsert pattern used by the existing catalog-extraction-application-zones exploration is available here too
- **Precedent collection:** mirrors `ApplicationZones`, `AdministrationRoutes`, `AdverseEffects`, `Contraindications`, `ApplicationTechniques`, `ClinicalNotes`, `Protocols` — the codebase has an established "flat normalized catalog" pattern. The companion change `.openspec/changes/catalog-extraction-application-zones/exploration.md` is the template this exploration mirrors.

The collection is currently **empty** (no rows seeded). The application depends on a non-empty list — `Products.activeIngredients` is `hasMany: true`, so it can stay empty per-product, but the clinical-agent cannot answer "what products contain Ácido hialurónico?" without the catalog.

Source data lives in two Markdown corpora on disk plus one aggregated index:

| Corpus | Path | Count | Purpose |
|--------|------|-------|---------|
| Category guides | `catalogs/*.md` (root) | 14 | One file per clinical category (rellenos, toxinas, enzimas, hilos, etc.) — primary source for combined compositions (e.g., "Hidroxiapatita de calcio + Carboximetilcelulosa") |
| Category index mirrors | `catalogs/indices/*.md` | 15 | Cleaner structured mirrors, include clinical warnings — duplicate content of root, skip to avoid double-counting |
| Product datasheets | `real-products/*.md` | 64 | One file per SKU (HYALURONIC ACID, REJUBELLA, ULTRA CA+, etc.) — primary source for single-ingredient products |
| Aggregated index | `catalogs/indice.md` | 1 | Per-category structured summary with `**Ingredientes:**` blocks, used for cross-product validation |
| Synonym map (autogen) | `real-products/product-name-map.ts` | n/a | Maps product aliases → filenames; **not** for ingredients, do not reuse |

There are **no existing extraction scripts** in the repo — `src/scripts/` only contains DB migration helpers (`run-migrate.ts`, `run-migrate-create.ts`, `list-db-tables.ts`, `drop-payload-tables.ts`). The `lib/scripts/sync-knowledge.py` referenced in `product-name-map.ts` header is not present in the repo (it was used to generate the alias map only — not for ingredient extraction).

## Affected Areas

- `src/collections/ActiveIngredients.ts` — collection definition (already exists, no schema change needed; we may add a unique index in a migration if duplicates must be prevented at the DB layer, but `payload.find` pre-check per the application-zones pattern is sufficient for now)
- `src/payload.config.ts` — already registered, no change needed
- `src/scripts/` — new directory for extraction scripts (e.g., `src/scripts/extract-active-ingredients.ts` running on Node + the Payload Local API)
- `real-products/*.md` (64 files) — primary source for per-product ingredient lists
- `catalogs/*.md` root (14 files) — primary source for category-level cross-product ingredients and combined compositions
- `catalogs/indices/*.md` (15 files) — skip (duplicate of root `catalogs/`)
- `catalogs/indice.md` (1 file) — secondary source for cross-category `**Ingredientes:**` blocks (validated against root catalogs)
- `src/collections/Products.ts` — downstream consumer; the `activeIngredients` relationship will be populated by a future task, not this one
- `CONTEXT.md` — domain glossary, reference for canonical term decisions (does not currently contain an "Active Ingredient" definition — must be added in a separate context phase if not present)

## Data Patterns Observed in Source Files

Six distinct source patterns were identified across the 78 candidate files. The extractor must handle all six:

### Pattern 1 — `**Composición:**` (combined, atomization required)

```
### Composición:
* Hidroxiapatita de calcio + Carboximetilcelulosa
```
Seen in `catalogs/Bioestimuladores, biorevitalizador, exosomas.md` (ULTRA CA+). The `+` separator requires atomization into two separate ingredients. The same pattern with `y` and `,` appears in cross-product lists (e.g., "Hidroxiapatita de calcio + ácido hialurónico" for HArmonyCa).

### Pattern 2 — `**Ingredientes:` (one per line, with dotted concentration)

```
**Ingredientes:**
Lidocaína........3mg/mL
Ácido hialurónico reticulado......24mg/mL
```
Seen in `catalogs/rellenos.md` and `catalogs/indice.md` (WIZFILL PLUS No.1/2/3). The `........` separator is a visual alignment column between name and concentration. Must strip everything after the dots.

### Pattern 3 — `**Ingredientes / Subtítulo:**` (one per line, no concentration)

```
## Sofiderm® Resurrection
* Hialuronato de sodio
* Trehalosa
```
Seen in `catalogs/Skin boosters.md`. Bulleted list, no concentrations, requires Title Case normalization (`Hialuronato de sodio` → `Hialuronato de sodio` after capitalizing first letter).

### Pattern 4 — `**ACTIVOS:**` / `**Activos:**`

```
**ACTIVOS:**
* Vitamina A (retinol).
* Vitamina E (tocopherol).
* Vitamina C (ácido ascórbico).
```
Seen in `real-products/AEC.md` and `real-products/DR.DMAE RED.md`. The `(parenthetical synonym)` is informative but must be stripped from the canonical name — `retinol` is the synonym for `Vitamina A`, the ingredient is `Vitamina A`. Decision needed: keep synonym as separate entry or drop. **Drop** — Vitamin A is the canonical ingredient, retinol is a synonym for the same chemical entity.

### Pattern 5 — `**Contenido:**` (bullet, single ingredient, sometimes with concentration)

```
**CONTENIDO:**
* Ácido hialurónico al 2% (no reticulado). 20 mg/ml.
```
Seen in `real-products/HYALURONIC ACID.md`, `real-products/CAFFEINE.md`, `real-products/DEOXICHOLIC 10%.md`, `real-products/DNA.md`, `real-products/ORGANIC SILICON.md`. Concentration and parenthetical descriptors (e.g., "no reticulado") must be stripped — the canonical ingredient is `Ácido hialurónico` (the cross-link status is a product/presentation attribute, not an ingredient attribute).

### Pattern 6 — Introductory prose (no header, descriptive paragraph)

```
Bioestimulador de colágeno a base de PDO (Polidioxanona).
Relleno dérmico a base de polidioxanona completamente compatibles con el cuerpo.
```
Seen in `real-products/REJUBELLA.md` and the `catalogs/Bioestimuladores` intro. The chemical name is buried in prose, not in a labeled field. Requires a small dictionary of known chemical-name → canonical-ingredient tokens for these well-known cases (PDO, Polidioxanona, Trehalosa, Argireline, DMAE, etc.).

### Pattern 7 — Table cells (markdown tables)

```
| **AH RETICULADO** | 24 mg/mL |
| **LIDOCAINA HCL** | 3 mg/mL |
```
Seen in `catalogs/rellenos.md` (ULTRAFILL KISS / NOSE / DEEP / SHAPE / FINE tables). The `**BOLD LEFT CELL**` is the ingredient, the right cell is the concentration. Must normalize `AH RETICULADO` → `Ácido hialurónico` (AH is a clinical acronym used in the data — it is **NOT** canonical; the glossary in the application-zones exploration does not list AH, so this normalization needs a one-line alias table: `AH` → `Ácido hialurónico`, `AH RETICULADO` → `Ácido hialurónico reticulado`, `AH no reticulado` → `Ácido hialurónico`).

### Pattern 8 — Inline in mix cocktails (no header, but a labelled subtitle)

```
# Out Contour
**Acetil hexapéptido DMAE Tocoferol Piruvato de sodio Pantenol**
```
Seen in `catalogs/regenerativos.md` and `catalogs/Skin boosters.md` (the ANTIAGING cocktail). The header line is a space-separated list, not a bulleted list. Each space-separated token must be validated against the synonym table.

### Pattern 9 — B-complex style numbered list (Vitamina B1, B3, B6, B9, B12)

```
* Vitamina B1, B3, B6, B9, B12.
```
Seen in `real-products/B-COMPLEX.md`. Each `B1`, `B3`, etc. is a separate ingredient, not a single "B-complex". Must atomize on `,` and `B[number]` regex. Same applies to **Vitaminas** as a generic group term (seen in DR.DMAE RED.md) — decision: keep `Vitaminas` as a single canonical entry, since the data sheet treats it as one ingredient label even though the underlying mixture varies.

## Approaches

### Option A — Manual curation by clinical reviewer (no script)

- **Pros:** Highest clinical accuracy on edge cases; no code; no infrastructure
- **Cons:** Slow (15-30 min per file × 78 files = 20-40 hours), non-reproducible, doesn't match the existing application-zones "automated extraction + review" pattern; clinical reviewer already has a heavy workload
- **Effort:** High (time), Low (code)

### Option B — Deterministic Node.js extraction script (regex-based, no LLM)

- **Pros:** Reproducible, idempotent, fast (~2-3s for 78 files), easy to diff, no API costs, runs offline; matches the pattern established by the application-zones change
- **Cons:** Brittle on introductory-prose patterns (Pattern 6) — requires a curated dictionary of ~15-20 known chemical names that appear in prose; the same brittleness the application-zones extractor solved with its synonym table
- **Effort:** Medium (script ~300-400 lines + `synonyms.json` lookup + `acronyms.json` for AH/PDO/BDDE)

### Option C — LLM-assisted extraction (use existing `streamText` pipeline or direct OpenAI call)

- **Pros:** Handles natural language variability well; can deal with all 9 patterns including the introductory prose; can disambiguate `(parenthetical synonym)` like `Vitamina A (retinol)` automatically
- **Cons:** Non-deterministic, costs money (~$0.10-0.30 per file × 78 = ~$8-25 per run), slower (~30-60s per file), requires prompt engineering + JSON validation, can hallucinate ingredients that aren't in the source (e.g., it might propose "Glucosa" when none of the source files mention it)
- **Effort:** Medium-High (prompt design + validation + cost tracking + hallucination guard)

### Option D — Hybrid: deterministic extraction → LLM review pass for ambiguous cases

- **Pros:** Most accurate; deterministic baseline covers 90% of patterns; LLM only handles Pattern 6 (intro prose) and Pattern 8 (header-line cocktails); cheaper than pure LLM
- **Cons:** Two-stage pipeline; more complex; needs a "low confidence" flag in the regex extractor
- **Effort:** High

## Recommendation

**Option B (deterministic script) with a curated synonym + acronym table, mirroring the application-zones extraction pattern.** Reasons:

1. **Precedent already exists** — `.openspec/changes/catalog-extraction-application-zones/exploration.md` shipped a deterministic script + synonym JSON approach for a parallel collection. Reusing the structure reduces review overhead and gives the user a consistent mental model across catalog extractions.
2. **The data is mostly structured** — 8 of 9 patterns (Patterns 1-5, 7, 9) are well-bounded Markdown with predictable section headers. Only Pattern 6 (intro prose) and Pattern 8 (header-line cocktails) need careful handling, and both are small in volume (~10-15 occurrences total across 78 files).
3. **Determinism is critical for clinical data** — the final list of ~40-60 canonical ingredient names will be stable for months. A false-positive "Glucosa" hallucinated by an LLM would require manual audit and rollback. Regex never hallucinates.
4. **MCP plugin is already configured** — `src/payload.config.ts:64` allows `create` and `update` on `active-ingredients` with `delete` disabled. The script can idempotently `payload.create()` per canonical name after a `payload.find({ where: { name: { equals: ... } } })` collision check.
5. **The synonym table is editable by the clinical director** — a flat JSON file with ~40 entries (15 acronyms + 25 synonyms) is the right level of abstraction. No code change needed to add a new synonym.
6. **The script can output the strict `{ slug, data: [{name}] }` JSON for review BEFORE writing to Payload** — same as the application-zones pattern. Two-phase commit: (1) extract + normalize + dedupe → JSON file, (2) human review, (3) upsert via Payload Local API.

**Reserved judgment for the proposal/spec phase:**
- **`Vitaminas` as a single canonical entry** vs **expanding to `Vitamina A`, `Vitamina B1`, ..., `Vitamina C`** — the data sheets use the generic "Vitaminas" label, so keep as one entry. The B-complex file is the only one that atomizes.
- **`(parenthetical synonym)` handling** — drop the parenthetical from the canonical name (e.g., `Vitamina A (retinol)` → `Vitamina A`). The synonym belongs in a future `aliases` field on the collection, not in the canonical `name`.
- **`AH RETICULADO` and `AH no reticulado`** — both normalize to `Ácido hialurónico reticulado` and `Ácido hialurónico` respectively (preserving the cross-link status because it is a clinically meaningful variant). The bare `AH` acronym also normalizes to `Ácido hialurónico` (no cross-link qualifier by default).
- **`Colágeno hidrolizado`** vs **`Colágeno`** — keep as two separate entries if the data distinguishes them; otherwise merge. Initial scan suggests they are distinct (`Colágeno hidrolizado` appears in ULTRAGEN X, `Colágeno` is not seen as a standalone ingredient in the corpus).
- **`PDRN` (sodium DNA / PDRN de salmón / PDRN Trucha)** — should this be one entry `PDRN` or three (`PDRN`, `ADN sódico`, `PDRN de salmón`)? Clinical significance: `PDRN de salmón` and `ADN sódico` are the same chemical class; `PDRN Trucha` is a different species. **Recommend `PDRN`** as canonical with aliases for the variants.
- **`Lidocaína` vs `Lidocaína HCL` vs `Lidocaine HCL`** — keep as one entry `Lidocaína` (the HCL is the salt form, the active moiety is lidocaine).
- **`Silicio orgánico` vs `Organic silicon` vs `Dimetilaminoetanol` (DMAE)** — keep each as a separate entry; the relationship is product-level, not ingredient-level.
- **`Trehalosa` vs `Azúcar de resurrección`** — the second is a marketing synonym, not a chemical name. **Recommend `Trehalosa`** as canonical.

## Risks

- **Cross-link status loss for HA** — the data distinguishes `Ácido hialurónico reticulado` from `Ácido hialurónico no reticulado`. If we collapse both to `Ácido hialurónico`, we lose a clinically significant distinction. The application-zones exploration rejected this collapse for the same reason (singular vs plural). **Mitigation:** keep the cross-link status in the canonical name (`Ácido hialurónico reticulado`, `Ácido hialurónico no reticulado`).
- **Acronym ambiguity (AH)** — `AH` in the corpus means `Ácido hialurónico`, but the Spanish clinical community also uses it for `Ácido hialurónico` in general. A regex that matches "AH" as a standalone token will over-match (`HIALURONIC ACID` is a file name, not an ingredient line). **Mitigation:** only match `AH` as a token inside a recognized table cell (`**AH RETICULADO**`) or as a parenthetical in a recognized line, never as a free-standing word.
- **Concentration stripping vs description preservation** — `Ácido hialurónico al 2% (no reticulado). 20 mg/ml.` must become `Ácido hialurónico` OR `Ácido hialurónico no reticulado`, not `Ácido hialurónic`. The regex must capture `(no reticulado)` as a qualifier but drop `al 2%` and `20 mg/ml`. **Mitigation:** define a strict qualifier whitelist: `reticulado`, `no reticulado`, `de alto peso molecular`, `de bajo peso molecular` are kept; everything else is dropped.
- **Combined `+` vs `y` vs `,` atomization** — `Hidroxiapatita de calcio + Carboximetilcelulosa` (one product) vs `Vitaminas B1, B3, B6, B9, B12` (B-complex, multi-ingredient) both use separators but mean different things. **Mitigation:** only atomize on `+` and ` y ` (lowercase, surrounded by spaces) inside a recognized `**Composición:**` or `**Ingredientes:**` block. Atomize on `,` only inside a `Vitaminas B<digit>` line (regex `/Vitaminas?\s+B\d+(?:\s*,\s*B\d+)*\b/`).
- **Empty placeholder sections** — `real-products/HYALURONIDASE.md` and `real-products/LIPASE.md` have `## ACTIVOS:` or similar header with no body. The script must detect "section exists but is empty" and skip. Same as the application-zones risk.
- **Idempotency** — MCP plugin allows create but not delete. If the script runs twice, we need `payload.find({ collection: 'active-ingredients', where: { name: { equals: ingredientName } } })` before each create to avoid 409s. Application-zones pattern is `find → if empty then create` per row.
- **Cross-source duplicates** — `Ácido hialurónico` appears in ~25 files across both corpora. The script must dedupe by canonical name (normalized) and only write one row per unique name.
- **Diacritics and case normalization for matching only** — `Lidocaína` vs `LIDOCAINA` vs `Lidocaina` vs `Lidocaine` vs `Lidocain HCL` are all the same canonical entity. **Mitigation:** normalize a `matchKey` to lowercase + NFD-strip-diacritics for dedup/comparison, but write the display form with original diacritics and Title Case.
- **Dotted concentration separator `........`** — appears in `WIZFILL PLUS` ingredient lines. The regex must split on `\s*[.]{4,}\s*` and discard the right side.
- **Markdown table parsing** — table cell ingredients (Pattern 7) require a separate regex pass that walks the `|`-delimited rows and extracts the left cell content from rows where the left cell is `**BOLD**`.
- **Plural vs singular in canonical name** — `Vitaminas` appears plural; `Aminoácidos` appears plural; `Coenzimas` appears plural. The task says "Capitalize first letter" but does not mandate singular. The corpus uses plural. **Recommend plural** to match the source. If the user wants singular, the proposal phase can flip it.
- **Empty Markdown table cells** — `catalogs/rellenos.md` has `| | T.S.K. Premium Needle ... |` rows that look like ingredients but are actually manufacturer notes. **Mitigation:** require the left cell to match a known chemical-name pattern; otherwise skip the row.

## Search Patterns Observed in Source Files

For the spec phase, these are the actual regex patterns the extractor will target (compiled list):

```
# Pattern 1 - Composición
^\s*\*?\*?\s*Composici[oó]n\s*:?\s*\*{0,2}\s*$
# Body: read next 1-3 lines, atomize on `+` and ` y `

# Pattern 2 - Ingredientes: with dotted concentrations
^\s*\*?\*?\s*Ingredientes\s*:?\s*\*{0,2}\s*$
# Body: read lines until next `**` or `##`, split each line on `\s*[.]{4,}\s*`, take left side

# Pattern 3 - Bulleted ingredient list (no header)
^\s*\*\s+(?=[A-ZÁÉÍÓÚÑ][a-záéíóúñ]*(?:\s+[a-záéíóúñ]+)*$)  # bullet + capitalized phrase
# Filter against synonym table

# Pattern 4 - ACTIVOS:
^\s*\*?\*?\s*Activos?\s*:?\s*\*{0,2}\s*$
# Body: bullet list, strip parenthetical synonyms with regex /\s*\([^)]*\)\.?/g

# Pattern 5 - CONTENIDO:
^\s*\*?\*?\s*Contenido\s*:?\s*\*{0,2}\s*$
# Body: bullet list, strip concentration /\s+(al|con)?\s*\d+([.,]\d+)?\s*%.*$/i

# Pattern 7 - Table cells
^\|\s*\*?\*?([^*\n|]+?)\*?\*?\s*\|\s*([\d.,]+\s*(?:mg|mL|%|U\/[\d.]+mL)\b)
# Extract group 1 if it matches the synonym table, else skip

# Pattern 8 - Header-line cocktails
^\*?\*?([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)+)\*?\*?$
# Validate each token against synonym table

# Pattern 9 - B-complex atomization
^\s*\*?\s*Vitaminas?\s+B\d+(?:\s*,\s*B\d+)*\.?\s*$
# Atomize to B1, B3, B6, B9, B12
```

## Proposed File Layout

```
src/scripts/extract-active-ingredients.ts   # The deterministic extractor
src/scripts/synonyms-active-ingredients.json  # ~25 synonym entries
src/scripts/acronyms-active-ingredients.json  # ~10 acronym entries
```

## Ready for Proposal

**Yes.** The exploration gives the orchestrator enough to launch a `sdd-propose` phase that writes:

1. `proposal.md` — intent (extract + atomize + normalize + dedupe + upsert canonical chemical/clinical ingredient names), scope (78 source files, 1 Payload collection), approach (Option B: deterministic script + synonym + acronym tables)
2. `specs/active-ingredients.md` — requirements: deterministic output, idempotent upsert, atomize on `+`/` y `, strip concentrations, strip parenthetical synonyms, normalize diacritics, Title Case first letter, keep cross-link status qualifier, dedupe by canonical name, support 9 documented source patterns
3. `design.md` — file layout: `src/scripts/extract-active-ingredients.ts` + `src/scripts/synonyms-active-ingredients.json` + `src/scripts/acronyms-active-ingredients.json`; the `name` field on `ActiveIngredients` stays as the only schema field; idempotency via `payload.find` pre-check
4. `tasks.md` — 1) build synonym + acronym tables from sample extraction, 2) implement 9-pattern regex extractor, 3) add atomization + normalization pipeline, 4) dry-run JSON output for clinical review, 5) real run + verify with Payload find

The orchestrator should tell the user: "Exploration complete. The `active-ingredients` Payload collection already exists and is empty. The proposed approach is a deterministic Node script (Option B) with synonym + acronym tables, mirroring the `catalog-extraction-application-zones` change. We will keep cross-link status on HA, drop parenthetical synonyms and concentrations, atomize on `+`/` y `, and keep plural canonical names. Ready to draft the formal proposal?"
