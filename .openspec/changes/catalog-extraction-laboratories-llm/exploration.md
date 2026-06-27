# Exploration: catalog-extraction-laboratories-llm

**Type:** architecture / data discovery
**Method:** LLM inference over 64 product datasheets in `real-products/*.md` (corpora in `catalogs/*.md` verified to add no new labs).

## Current State

The `laboratories` Payload CMS collection exists with a flat `{name: text}` schema. The product corpus (`real-products/*.md`) declares manufacturers under one of three heading variants:
- `## LABORATORIO Y PAÍS DE ORIGEN:` (most common)
- `## LABORATORIO Y LUGAR:` (Celosome family)
- `## LABORATORIO Y LUGAR DE FABRICACIÓN:` (WIZMEDI / Wizmedi family)

Country is always co-located on the same line as the lab name (e.g. `Laboratorio MCCM, España` or `Cosmoderma Inc, Corea del Sur`). The extraction task requires a consolidated, deduplicated, country-free list of canonical lab names.

## Affected Areas
- `real-products/*.md` — primary source (64 files). Some files are missing the `LABORATORIO` section entirely and were excluded.
- `catalogs/*.md` — referenced only; adds no new labs.
- `.openspec/changes/catalog-extraction-laboratories-llm/laboratories.json` — final artifact (this change).
- `lib/knowledge.ts` (no changes needed) — the static knowledge string is independent of this collection.

## Approaches considered

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Regex / line scan** | Fast, deterministic | Misses synonyms (Cosmoderma vs Cosmoderma Inc), can't handle missing sections, can't infer from the prompt's "ej. Cosmoderma Inc o Cosmoderma" flexibility | Low |
| **LLM inference (chosen)** | Handles semantically equivalent names, can normalize, can decide on edge cases | Slightly slower, requires careful per-file reasoning | Medium |
| Hybrid: LLM for normalization + deterministic dedup | Combines both | Overkill for a 64-file corpus, adds tooling surface | Medium |

## Recommendation

LLM inference end-to-end, as specified. The corpus is small (≤ 80 files) and the user explicitly required LLM. The 11 unique labs identified are stable across all 64 files — no ambiguity that would require re-running.

## Final list (11 unique labs, alphabetical)

```json
{
  "slug": "laboratories",
  "data": [
    { "name": "Cosmoderma" },
    { "name": "ExoCoBio" },
    { "name": "Hugelpharma" },
    { "name": "MCCM" },
    { "name": "Maypharm" },
    { "name": "Metabiomed" },
    { "name": "PROMOITALIA" },
    { "name": "Protox" },
    { "name": "SOONSU" },
    { "name": "Techderm" },
    { "name": "WIZMEDI" }
  ]
}
```

## Normalization decisions

| Source | Canonical | Why |
|---|---|---|
| "Cosmoderma, Corea del Sur" / "Cosmoderma Inc, Corea del Sur" | `Cosmoderma` | Drop corporate suffix "Inc"; user prompt explicitly lists both as acceptable. |
| "ExoCoBio Inc, Corea del Sur" | `ExoCoBio` | Drop "Inc". |
| "Hugelpharma. Corea del Sur." | `Hugelpharma` | Drop country. |
| "Laboratorio MCCM, España" / "🇪🇸 Laboratorio MCCM, España." | `MCCM` | "Laboratorio" is a Spanish generic noun (not part of the brand); drop prefix, flag emoji, and country. |
| "Maypharm. Corea del Sur." | `Maypharm` | Drop country. |
| "Metabiomed, Corea del Sur." | `Metabiomed` | Drop country. |
| "PROMOITALIA medical aesthetics, Italia." | `PROMOITALIA` | "medical aesthetics" is a descriptor, not part of the corporate name. |
| "Protox. Corea del Sur." | `Protox` | Drop country. |
| "SOONSU, Corea del Sur." | `SOONSU` | Drop country. |
| "Techderm, China." | `Techderm` | Drop country. |
| "Wizmedi. Corea del Sur." / "WIZMEDI, Corea del Sur." / "WIZMEDI CO., LTD., Corea del Sur." | `WIZMEDI` | Unified to ALL CAPS (matches the brand's official label style); dropped "CO., LTD." suffix. |

## Edge cases (excluded — manufacturer not declared in source)

Five products have no `LABORATORIO` section and were intentionally excluded. They should be resolved by the clinical director in a follow-up change if needed:

- `BELLATOXEL.md` — botulinum toxin, no manufacturer declared.
- `HILOS PDO.md` — generic PDO thread category overview, not a single product.
- `LIDOCAINA.md` — topical anesthetic; no manufacturer.
- `LIPO LAB.md` — no manufacturer.
- `VNS.md` — no manufacturer.

## Lab → product coverage

| Lab | # products |
|---|---|
| MCCM | ~30 (mesotherapy family) |
| Cosmoderma | 8 (LIPORASE, ULTRA BODY, ULTRA CA+, ULTRA HILO, ULTRAFILL/KISS/NOSE, ULTRAGEN X) |
| WIZMEDI | 5 (DR.DMAE RED, THE BLACK, WICKED SNOW WHITE, WIZFILL PLUS, WIZTOX) |
| Techderm | 3 (SOFIDERM 1ml, 2ml, SKIN BOOSTER) |
| ExoCoBio | 2 (CELOSOME, CELOSOME-XSHAPE) |
| Hugelpharma | 1 (BOTULAX) |
| Protox | 1 (BTSA9) |
| Maypharm | 1 (METOX) |
| PROMOITALIA | 1 (PINK INTIMATE SYSTEM) |
| Metabiomed | 1 (REJUBELLA) |
| SOONSU | 1 (SOONSU SHINING PEEL) |

## Risks
- 5 products have no declared manufacturer. Payload CMS will need either a nullable relationship, manual mapping, or a follow-up change once the clinical director confirms.
- Future corpus additions (new `.md` files) will require re-running this extraction. The proposal phase should consider a CI guard or a re-run trigger.

## Ready for Proposal
**Yes.** The 11-lab list is final and can drive the Payload CMS upsert. Recommend `sdd-propose` next, then `sdd-spec` to capture the upsert workflow and the gap-resolution plan for the 5 unattributed products.
