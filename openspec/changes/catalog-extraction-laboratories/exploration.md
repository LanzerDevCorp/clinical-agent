# SDD Explore: Laboratories Collection Extraction

## Current State

The `laboratories` Payload CMS collection **already exists** and is registered. No schema work is required — this is a pure data-extraction task.

- **Collection**: `src/collections/Laboratories.ts` — single `name: text` (required), `useAsTitle: 'name'`, group `Catálogos`.
- **Registered in**: `src/payload.config.ts` (line 11, line 35).
- **MCP enabled**: `find`, `create`, `update` for `laboratories` (line 63 of payload.config.ts).
- **Already referenced** by `Products.laboratory` (relationship, required) at `src/collections/Products.ts:54-59`.
- **No existing extraction scripts**. `src/scripts/` only contains DB-migration scripts (drop-payload-tables, list-db-tables, run-migrate*).

## Affected Areas

| Path | Why it matters |
|------|---------------|
| `C:\git_root\clinical-agent\real-products\*.md` | Source of truth — 64 clinical datasheets |
| `src/collections/Laboratories.ts` | Target collection (no changes needed) |
| `src/payload.config.ts` | Already registers Laboratories + MCP |
| `src/collections/Products.ts` | `laboratory` relationship is already in place; only needs data |
| `src/scripts/extract-laboratories.ts` | **New file** — extraction + upsert script (TDD target) |
| `tests/int/extract-laboratories.test.ts` | **New file** — unit tests for regex + cleanup pipeline |

## Data Source Survey

64 Markdown datasheets in `real-products/`. **59 contain a LABORATORIO section**; 5 do not (need manual review: BELLATOXEL, HILOS PDO, LIDOCAINA, LIPO LAB, VNS).

### Header variants (regex must cover all)

| Variant | Example file |
|---------|--------------|
| `## LABORATORIO Y PAÍS DE ORIGEN:` | HYALURONIC ACID, WHITENING, ARTICHOKE |
| `### LABORATORIO Y PAÍS DE ORIGEN:` | ARGIRELINE, ASIAN CENTELLA, BIOTIN HIDRIXIN |
| `**LABORATORIO Y PAÍS DE ORIGEN:**` | AEC, CAFFEINE, DEOXICHOLIC 10%, DNA, ORGANIC SILICON, REJUBELLA, MESO K - FINASTERIDE |
| `**LABORATORIO Y PAÍS DE ORIGEN:** <value>` (same line) | ULTRAFILL NOSE |
| `## LABORATORIO Y LUGAR DE FABRICACIÓN:` | DR.DMAE RED, WICKED SNOW WHITE |
| `## LABORATORIO Y LUGAR:` (abbreviated) | CELOSOME |
| `### LABORATORIO Y PAÍS DE ORIGEN` (no colon) | ULTRAFILL KISS |
| Without accents: `PAIS`, `FABRICACION` | METOX, BTSA9, CLH LIPASE 1500 |

### Value variants

| Pattern | Example |
|---------|---------|
| `Laboratorio MCCM, España.` | Most MCCM products |
| `🇪🇸 Laboratorio MCCM, España.` | GLUTATHIONE, TRANEXAMICUM, AEC |
| `Laboratorio MCCM, **España**.` | LAURETH |
| `* WIZMEDI CO., LTD., Corea del Sur.` | DR.DMAE RED (bullet prefix) |
| `Cosmoderma Inc, Corea del Sur.` | ULTRAFILL, ULTRA CA+ (no "Laboratorio" prefix) |
| `Corea del Sur, ExoCoBio Inc.` | CELOSOME-XSHAPE (country first!) |
| `Wizmedi. Corea del Sur.` | WIZTOX, THE BLACK, WICKED SNOW WHITE (period separator) |
| `PROMOITALIA medical aesthetics, Italia.` | PINK INTIMATE SYSTEM |
| `Techderm, China.` | SOFIDERM 1ml, SOFIDERM 2ml, SOFIDERM SKIN BOOSTER |
| `http://celosome.com/` | CELOSOME-XSHAPE next line (URL noise) |

## Approaches

### Approach A — Single regex + cleanup pipeline (Recommended)
- One Node/TS script `src/scripts/extract-laboratories.ts`
- In-memory regex pipeline; no external deps
- Pure function, fully unit-testable
- **Pros**: simple, fast, no MCP overhead, deterministic, easy TDD
- **Cons**: requires writing the regex carefully
- **Effort**: Low

### Approach B — Use MCP plugin to upsert
- The MCP plugin already has `create` enabled for `laboratories`
- Could write a script that calls MCP for upsert
- **Pros**: zero transport code, uses existing infra
- **Cons**: requires MCP server running; harder to test; not idempotent by default
- **Effort**: Medium

### Approach C — AI-assisted extraction via existing `extract-product` skill
- The skill is referenced in AGENTS.md but not installed locally (user-level only)
- Reuse the same AI prompt that powers the per-product extraction
- **Pros**: handles ambiguous cases via LLM reasoning
- **Cons**: non-deterministic, slow, expensive, no TDD red-green loop
- **Effort**: Medium-High (skill integration work)

## Recommendation

**Approach A** — single regex + cleanup pipeline.

Rationale:
1. The data is small (64 files) and highly structured.
2. The extraction logic is fully deterministic — ideal for TDD.
3. The cleanup pipeline (country strip, legal suffix strip, case-folding) covers every variant observed.
4. Strict TDD mode is ENABLED in the project (per AGENTS.md) — Approach A enables clean red-green-refactor.
5. Approach C violates the "concepts > code" principle: we're using AI to do mechanical regex work.

For upsert, query Payload Local API by `name` and `create` only if missing — this is idempotent and uses Payload's native data layer (no MCP dependency).

## Extracted Result (11 unique labs, JSON)

```json
{
  "slug": "laboratories",
  "data": [
    { "name": "Cosmoderma" },
    { "name": "ExoCoBio" },
    { "name": "Hugelpharma" },
    { "name": "Maypharm" },
    { "name": "MCCM" },
    { "name": "Metabiomed" },
    { "name": "PROMOITALIA" },
    { "name": "Protox" },
    { "name": "SOONSU" },
    { "name": "Techderm" },
    { "name": "WIZMEDI" }
  ]
}
```

Distribution: MCCM dominates with 35 products (mesotherapy/cocktails, all from España). Cosmoderma is second (8 products, all Corea del Sur fillers). The remaining 9 labs each have 1–5 products.

## Edge Cases & Risks

1. **Country-before-lab inversion** (CELOSOME-XSHAPE: `Corea del Sur, ExoCoBio Inc.`) — must handle both `,` and `.` separators, and country in either position.
2. **Period separator for country** (BOTULAX, METOX, BTSA9, WIZTOX, WICKED SNOW WHITE: `Hugelpharma. Corea del Sur`) — easy to miss.
3. **Encoding drift** — some files use `PAIS` (no accent), `FABRICACION` (no accent); regex must accept both.
4. **Legal suffix variants** — `CO., LTD.`, `Inc`, `INC`, `LTD` — strip conservatively (don't strip if brand stem becomes 1-2 chars).
5. **PROMOITALIA medical aesthetics** — descriptor after brand; treat as suffix.
6. **URL on subsequent line** (CELOSOME-XSHAPE) — strip anything from `http://` onward.
7. **5 files with no LABORATORIO section** — flag for manual review; do NOT silently skip (could mask data loss).
8. **Case preservation** — keep first-observed casing as canonical (e.g., `WIZMEDI` from DR.DMAE RED, even though WIZTOX uses `Wizmedi`).

## Implementation Plan (proposal)

1. **Spec phase** (sdd-spec): write scenarios for header detection, value extraction, cleanup, and dedup edge cases.
2. **Task phase** (sdd-tasks): break into TDD tasks — regex tests → pipeline tests → upsert tests.
3. **Apply phase** (sdd-apply): red-green-refactor for the extraction + idempotent upsert via Payload Local API.
4. **Verify phase** (sdd-verify): run extraction, assert 11 unique records, assert all 59 LAB sections were captured, assert no duplicates on second run.
5. **Archive phase** (sdd-archive): sync the final canonical list to `openspec/specs/laboratories/spec.md`.

## Ready for Proposal

**Yes** — the data model is stable, the source is well-understood, and the extraction logic is fully deterministic and testable. The orchestrator should:
1. Tell the user the **11 extracted labs** (above) and ask for sign-off.
2. Propose writing the extraction script under TDD with the cleanup pipeline.
3. Confirm whether to upsert via Payload Local API (recommended) or MCP (alternative).
4. Decide how to handle the 5 files with no LABORATORIO section (manual review queue, or skip with logged warning).
