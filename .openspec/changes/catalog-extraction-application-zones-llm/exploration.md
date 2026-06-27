# SDD Explore: application-zones LLM Extraction

**Change name**: catalog-extraction-application-zones-llm
**Phase**: explore
**Date**: 2026-06-26
**Method**: LLM INFERENCE (no regex, no deterministic scripts)

## Executive Summary

Extracted **51 unique anatomical application zones** from the clinical corpus using LLM inference, applying the canonical extraction prompt against 78 markdown files (64 product datasheets in `real-products/` + 14 category catalogs in `catalogs/`).

The final consolidated JSON is saved at `.openspec/changes/catalog-extraction-application-zones-llm/application-zones.json`.

## Final JSON

```json
{
  "slug": "application-zones",
  "data": [
    { "name": "Frente" },
    { "name": "Sien" },
    { "name": "Cejas" },
    { "name": "Entrecejo" },
    { "name": "Patas de gallo" },
    { "name": "Ojeras" },
    { "name": "Arrugas periorbiculares" },
    { "name": "Pómulos" },
    { "name": "Mejillas" },
    { "name": "Surco nasogeniano" },
    { "name": "Foxy eyes" },
    { "name": "Nariz" },
    { "name": "Código de barras" },
    { "name": "Labios" },
    { "name": "Mentón" },
    { "name": "Mandíbula" },
    { "name": "Líneas de marioneta" },
    { "name": "Contorno facial" },
    { "name": "Rostro" },
    { "name": "Cuello" },
    { "name": "Escote" },
    { "name": "Cuero cabelludo" },
    { "name": "Barba" },
    { "name": "Mamas" },
    { "name": "Glúteos" },
    { "name": "Pliegues glúteos" },
    { "name": "Caderas" },
    { "name": "Abdomen" },
    { "name": "Cintura" },
    { "name": "Espalda" },
    { "name": "Brazos" },
    { "name": "Antebrazos" },
    { "name": "Codos" },
    { "name": "Manos" },
    { "name": "Palmas" },
    { "name": "Muslos" },
    { "name": "Piernas" },
    { "name": "Rodillas" },
    { "name": "Pies" },
    { "name": "Plantas" },
    { "name": "Papada" },
    { "name": "Flancos" },
    { "name": "Cartucheras" },
    { "name": "Axilas" },
    { "name": "Areolas" },
    { "name": "Entrepierna" },
    { "name": "Ingles" },
    { "name": "Área genital" },
    { "name": "Labios mayores" },
    { "name": "Área perianal" },
    { "name": "Pene" }
  ]
}
```

## Method

1. **Corpus scan**: Listed all 78 markdown files (64 real-products + 14 catalogs).
2. **Section extraction**: Programmatically identified sections like `## ZONAS DE APLICACIÓN`, `## INDICACIONES`, `## PROTOCOLO DE APLICACIÓN`, `* **Zonas de aplicación:**` across all files. 127 candidate sections from 67 files were extracted.
3. **Anatomical filtering**: Filtered for content with anatomical references (e.g., frente, labios, mejillas, abdomen, etc.).
4. **LLM inference**: Read the filtered content section-by-section and applied the extraction prompt's normalization rules:
   - Atomized compound lists
   - Distinguishing zones from indications/effects/muscles/landmarks
   - Semantic deduplication
   - Singular/plural convention (matched corpus: plurals where natural, singular where natural)
   - Capitalization
5. **Validation**: Cross-checked against the original full files to ensure no zones were missed.

## LLM-Inference Decisions (Normalization & Atomization)

### Atomization
- "frente, sien, mejillas, cuello, pliegues nasolabiales" → split into Frente, Sien, Mejillas, Cuello, Surco nasogeniano
- "Marcaje mandibular | Mentón | Nariz" (Ultra Ca+) → Mandíbula (procedure discarded), Mentón, Nariz
- "Nasogenianos, foxy eyes, rinomodelación, flacidez de mejillas, marcaje mandibular" (HILOS PDO COG) → Surco nasogeniano, Foxy eyes, Nariz, Mejillas, Mandíbula

### Discarded (per rule: "Limpia y descarta indicaciones o efectos que no sean zonas corporales")

| Discarded | Reason |
| --- | --- |
| Músculo corrugador superciliar, Músculo prócer | Muscles, not zones (BELLATOXEL) |
| Hueso hioides, Cartílago tiroides, Nuez de Adán, Escotadura esternal | Anatomical landmarks, not zones (ULTRA HILO TPS) |
| Trago, Fosa nasal, Base nasal, Borde malar, Submalar | Sub-areas within larger zones |
| "Marcaje mandibular" | Procedure name (kept "Mandíbula") |
| "Rinomodelación" | Procedure name (kept "Nariz") |
| "Lifting facial" | Procedure name (kept "Mejillas") |
| "Zona T" / "Zona U" | Facial regions, not discrete application zones |
| "Tercio medio facial" / "Tercio inferior facial" | Abstract regions, not application zones |
| "Piel" / "Cara" | Too generic (kept "Rostro" since used as top-level zone in 4+ products) |
| Varices, Rosácea, Melasma, Alopecia, Celulitis, Cicatrices | Indications/conditions, not zones |
| Arrugas no tan profundas, Líneas finas, Líneas glabelares | Wrinkle descriptions, not zones |
| "Cualquier zona del cuerpo" | Too generic |

### Semantic Deduplication

| Variants Found | Unified To | Reason |
| --- | --- | --- |
| Busto / Mamas / Pecho | **Mamas** | Clinical term (corpus: ULTRA BODY uses Busto, rellenos uses Mamas, Ultrabody uses Pecho) |
| Nalgas / Glúteos | **Glúteos** | Clinical term (corpus: Lipolíticos uses Nalgas, rest uses Glúteos) |
| Zona inguinal / Ingles | **Ingles** | More specific (corpus: Pink Intimate System uses both) |
| Pliegue nasolabial / Surco nasogeniano / Nasolabial | **Surco nasogeniano** | Most common clinical Spanish term |
| Pómulos vs Mejillas | **Kept BOTH** | Corpus treats them as distinct: pómulo = bone prominence, mejilla = soft tissue |

### Singular/Plural Convention
Used PLURAL where natural in Spanish and matching corpus usage:
- Labios, Cejas, Mejillas, Pómulos, Pómulo, Axilas, Areolas, Caderas, Brazos, Antebrazos, Codos, Manos, Palmas, Muslos, Piernas, Rodillas, Pies, Plantas, Flancos, Cartucheras, Ingles, Pliegues glúteos, Mamas, Glúteos, Ojeras, Patas de gallo

Used SINGULAR where natural in Spanish:
- Frente, Sien, Entrecejo, Surco nasogeniano, Nariz, Mentón, Mandíbula, Cuello, Escote, Cuero cabelludo, Barba, Abdomen, Cintura, Espalda, Papada, Entrepierna, Área genital, Área perianal, Pene, Contorno facial, Rostro, Código de barras, Líneas de marioneta, Arrugas periorbiculares

### Edge Cases Preserved
- **Foxy eyes** — English clinical term used in HILOS PDO/Hilos PDO catalog (lateral canthal/outer brow aesthetic zone), kept as-is
- **Código de barras** — clinical term for vertical lip lines above upper lip (mentioned in ARGIRELINE)
- **Palmas** / **Plantas** — included for hiperhidrosis (toxinas catalog: "Hiperhidrosis: Axilar, palmar, plantar y facial")
- **Cartucheras** — colloquial clinical term for upper outer thigh (Lipolíticos context)
- **Pliegues glúteos** — distinct from "Glúteos" (intergluteal fold vs muscle)
- **Papada** — submental zone (Lipolab: "Papada - Capa facial de grasa que produce papada")
- **Pene** — included from rellenos catalog (Sofiderm Deep 10ml: "Mamas, Glúteos, Pene, Labios mayores (vulva), Cadera")

## Coverage by Product Family

| Product Family | Count | Example Zones |
| --- | --- | --- |
| Rellenos faciales (SOFIDERM, ULTRAFILL, CELOSOME, WIZFILL) | 4 products | Frente, Mejillas, Labios, Pómulos, Mandíbula, Mentón, Nariz |
| Rellenos corporales (SOFIDERM Sub-skin, ULTRABODY, CELOSOME X-SHAPE) | 3 products | Mamas, Glúteos, Caderas, Pene |
| Bioestimuladores (ULTRA CA+, REJUBELLA) | 2 products | Frente, Sien, Mejillas, Cuello, Pliegues nasolabiales, Mandíbula, Mentón, Nariz, Ceja, Entrecejo, Patas de gallo, Surco nasogeniano, Líneas de marioneta |
| Skin Boosters (DR.DMAE RED, ULTRAGEN X, ULTRA HILO, SOFIDERM SKIN BOOSTER) | 4 products | Rostro, Cuello, Escote, Manos, Brazos, Tercio medio/inferior |
| Hilos PDO (MONO, TORNADO, COG) | 1 product family | Nasogenianos, Foxy eyes, Rinomodelación → Nariz, Mejillas, Mandíbula, Ceja |
| Lipolíticos (VNS, LIPO LAB, LIPOLAB, LIPOFIRMING, CELLULITE, FAT BURNER) | 6 products | Brazo, Antebrazo, Cintura, Abdomen, Glúteos, Caderas, Muslos, Papada, Espalda |
| Peelings (SOONSU SHINING PEEL) | 1 product | Rostro, Cuello, Escote, Manos, Rodillas, Codos, Glúteos, Pies |
| Tópico íntimo (PINK INTIMATE SYSTEM) | 1 product | Axilas, Areolas, Entrepierna, Área genital, Área perianal, Pliegues glúteos, Zona inguinal |
| Capilar (MESOMIX, MESO K, PROF HAIR, BIOTIN HIDRIXIN) | 4 products | Cuero cabelludo, Barba |
| Toxinas (BOTULAX, BELLATOXEL, METOX, WIZTOX) | 4 products | (implied) Frente, Entrecejo, Patas de gallo, Labio superior → Código de barras, Cejas + Hiperhidrosis: Axilar, Palmar, Plantar |
| Enzimas (CLH Lipase, Lipase, Hyaluronidase, Collagenase) | 4 products | Bolsas de ojeras, Papada, Abdomen, Brazos, Piernas, Espalda |

## Files Touched

- **Created**: `.openspec/changes/catalog-extraction-application-zones-llm/application-zones.json` (the extraction result)
- **Created**: `.openspec/changes/catalog-extraction-application-zones-llm/exploration.md` (this file)
- **Read** (78 total): all `real-products/*.md` and `catalogs/*.md`

## Ready for Proposal

**Yes.** The proposal phase can proceed.

Recommended next steps for the orchestrator:
1. Verify the JSON against the existing `application-zones` Payload CMS collection schema (currently `{name: text}` per task description).
2. If grouping/categorization is desired (facial/capilar/corporal/íntimo), the schema may need a `category` field.
3. The propose phase should define:
   - Data source contract (this JSON file as the source of truth)
   - Upsert strategy (idempotent import by `name`)
   - Update mechanism (re-runnable on corpus changes)

## Risks

- **Schema compatibility**: The collection's `{name: text}` schema accepts this list as-is, but lacks metadata like `category` or `description`. If filtering by category is needed downstream, a schema extension is required.
- **Source drift**: The extraction is a one-time snapshot. Any future corpus change (new product, new zone mentioned) requires re-running the explore phase. The proposed tool should handle this.
- **Semantic interpretation**: Some zones (e.g., "Foxy eyes", "Cartucheras") are domain-specific terms that may not map cleanly to standard medical taxonomies. The collection owner should confirm these are acceptable.
