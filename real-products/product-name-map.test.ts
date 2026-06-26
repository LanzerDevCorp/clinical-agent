import { describe, it, expect } from 'vitest';
import { resolveProductFilename } from './product-name-map';

describe('resolveProductFilename', () => {
    // ═══════════════════════════════════════════════════
    // Canonical names (tal cual aparecen en index.md)
    // ═══════════════════════════════════════════════════

    describe('nombres canónicos del índice', () => {
        it('resuelve Bioestimuladores', () => {
            expect(resolveProductFilename('Rejubella')).toBe('REJUBELLA.md');
            expect(resolveProductFilename('Ultra Ca+')).toBe('ULTRA CA+.md');
            expect(resolveProductFilename('Ultrahilo')).toBe('ULTRA HILO.md');
            expect(resolveProductFilename('Ultragen X')).toBe('ULTRAGEN X.md');
        });

        it('resuelve Toxinas', () => {
            expect(resolveProductFilename('BELLATOXEL')).toBe('BELLATOXEL.md');
            expect(resolveProductFilename('BOTULAX')).toBe('BOTULAX.md');
            expect(resolveProductFilename('BTSA 9')).toBe('BTSA9.md');
            expect(resolveProductFilename('METOX')).toBe('METOX.md');
            expect(resolveProductFilename('WIZTOX')).toBe('WIZTOX.md');
        });

        it('resuelve Lipolíticos', () => {
            expect(resolveProductFilename('Artichoke')).toBe('ARTICHOKE.md');
            expect(resolveProductFilename('Asian Centella')).toBe('ASIAN CENTELLA.md');
            expect(resolveProductFilename('Caffeine')).toBe('CAFFEINE.md');
            expect(resolveProductFilename('Cellestabyl')).toBe('CELLESTABYL.md');
            expect(resolveProductFilename('Cellulite')).toBe('CELLULITE.md');
            expect(resolveProductFilename('Deoxycholic 10%')).toBe('DEOXICHOLIC 10%.md');
            expect(resolveProductFilename('Fat Burner')).toBe('FAT BURNER.md');
            expect(resolveProductFilename('L-Carnitine')).toBe('L CARNITINE.md');
            expect(resolveProductFilename('Lipo Firming')).toBe('LIPO FIRMING.md');
            expect(resolveProductFilename('Phosphatidylcholine')).toBe('PHOSPHATIDYLCHOLINE.md');
            expect(resolveProductFilename('VNS')).toBe('VNS.md');
        });

        it('resuelve Despigmentantes', () => {
            expect(resolveProductFilename('Glutathione')).toBe('GLUTATHIONE.md');
            expect(resolveProductFilename('MELANOout')).toBe('MELANOOUT.md');
            expect(resolveProductFilename('Tranexamicum')).toBe('TRANEXAMICUM.md');
            expect(resolveProductFilename('Whitening')).toBe('WHITENING.md');
        });

        it('resuelve Regenerativos', () => {
            expect(resolveProductFilename('AEC')).toBe('AEC.md');
            expect(resolveProductFilename('Antiaging')).toBe('ANTIAGING.md');
            expect(resolveProductFilename('Argireline')).toBe('ARGIRELINE.md');
            expect(resolveProductFilename('B-Complex')).toBe('B-COMPLEX.md');
            expect(resolveProductFilename('CLH Lipase')).toBe('enzimas.md');
            expect(resolveProductFilename('DMAE')).toBe('regenerativos.md');
            expect(resolveProductFilename('Laureth')).toBe('LAURETH.md');
            expect(resolveProductFilename('Organic Silicon')).toBe('ORGANIC SILICON.md');
            expect(resolveProductFilename('Out Contour')).toBe('OUT CONTOUR.md');
            expect(resolveProductFilename('Skin Repair')).toBe('SKIN REPAIR.md');
            expect(resolveProductFilename('Vitamina A')).toBe('regenerativos.md');
            expect(resolveProductFilename('Vitamina C')).toBe('VITAMINA C.md');
        });

        it('resuelve Rellenos', () => {
            expect(resolveProductFilename('The Black')).toBe('THE BLACK.md');
            expect(resolveProductFilename('Ultra Body')).toBe('ULTRA BODY.md');
            expect(resolveProductFilename('Ultra Fill')).toBe('ULTRAFILL.md');
            expect(resolveProductFilename('Ultrafill Kiss')).toBe('ULTRAFILL KISS.md');
            expect(resolveProductFilename('Ultrafill Nose')).toBe('ULTRAFILL NOSE.md');
            expect(resolveProductFilename('Wizfill+')).toBe('WIZFILL PLUS.md');
        });

        it('resuelve Skin Boosters', () => {
            expect(resolveProductFilename('Dr. DMAE Solution Essence Red')).toBe('DR.DMAE RED.md');
            expect(resolveProductFilename('Sofiderm Skin Booster')).toBe('SOFIDERM SKIN BOOSTER.md');
        });

        it('resuelve Hidratantes', () => {
            expect(resolveProductFilename('DNA')).toBe('DNA.md');
            expect(resolveProductFilename('Hyaluronic Acid 2%')).toBe('HYALURONIC ACID.md');
        });

        it('resuelve Hilos PDO', () => {
            expect(resolveProductFilename('Hilos PDO')).toBe('HILOS PDO.md');
        });

        it('resuelve Mesoterapia Capilar', () => {
            expect(resolveProductFilename('Biotin Hidrixin')).toBe('BIOTIN HIDRIXIN.md');
            expect(resolveProductFilename('Meso K - Finasteride')).toBe('MESO K - FINASTERIDE.md');
            expect(resolveProductFilename('Mesomix - Minoxidil')).toBe('MESOMIX - MINOXIDIL.md');
            expect(resolveProductFilename('Prof Hair')).toBe('PROF HAIR.md');
        });

        it('resuelve Dispositivos', () => {
            expect(resolveProductFilename('Dermapen')).toBe('Dermapen, agujas, aditamentos.md');
            expect(resolveProductFilename('Glowpen Pro')).toBe('Dermapen, agujas, aditamentos.md');
        });

        it('resuelve Enzimas', () => {
            expect(resolveProductFilename('CLH Lipase Cocktail')).toBe('enzimas.md');
            expect(resolveProductFilename('Collagenase')).toBe('enzimas.md');
            expect(resolveProductFilename('Hyaluronidase')).toBe('HYALURONIDASE LIQUID.md');
            expect(resolveProductFilename('Hyaluronidase Liquid')).toBe('HYALURONIDASE LIQUID.md');
            expect(resolveProductFilename('Lipasa')).toBe('enzimas.md');
            expect(resolveProductFilename('Liporase')).toBe('LIPORASE.md');
        });

        it('resuelve Otros Productos', () => {
            expect(resolveProductFilename('Lidocaina Mi-Caine')).toBe('LIDOCAINA.md');
            expect(resolveProductFilename('Pink Intimate System')).toBe('PINK INTIMATE SYSTEM.md');
            expect(resolveProductFilename('Soonsu Shining Peel')).toBe('SOONSU SHINING PEEL.md');
            expect(resolveProductFilename('Wicked Snow White')).toBe('WICKED SNOW WHITE.md');
        });
    });

    // ═══════════════════════════════════════════════════
    // Edge cases que el sistema anterior NO resolvía
    // ═══════════════════════════════════════════════════

    describe('casos problemáticos (anteriormente fallaban)', () => {
        it('Dr. DMAE — nombre índice vs filename corto', () => {
            expect(resolveProductFilename('Dr. DMAE Solution Essence Red')).toBe('DR.DMAE RED.md');
        });

        it('CLH Lipase — el índice y el filename no coinciden exactamente', () => {
            expect(resolveProductFilename('CLH Lipase')).toBe('enzimas.md');
            expect(resolveProductFilename('CLH Lipase Cocktail')).toBe('enzimas.md');
        });

        it('Productos con FT- prefijo no estándar', () => {
            expect(resolveProductFilename('Whitening')).toBe('WHITENING.md');
            expect(resolveProductFilename('The Black')).toBe('THE BLACK.md');
            expect(resolveProductFilename('VNS')).toBe('VNS.md');
        });

        it('BOTULAX y METOX tienen sufijo en el filename', () => {
            expect(resolveProductFilename('BOTULAX')).toBe('BOTULAX.md');
            expect(resolveProductFilename('METOX')).toBe('METOX.md');
        });

        it('L-Carnitine con guión vs filename con espacio', () => {
            expect(resolveProductFilename('L-Carnitine')).toBe('L CARNITINE.md');
            expect(resolveProductFilename('L-Carnitina')).toBe('L CARNITINE.md');
        });
    });

    // ═══════════════════════════════════════════════════
    // Alias y variaciones comunes
    // ═══════════════════════════════════════════════════

    describe('alias y variaciones', () => {
        it('tolera cualquier capitalización', () => {
            expect(resolveProductFilename('bellatoxel')).toBe('BELLATOXEL.md');
            expect(resolveProductFilename('BELLATOXEL')).toBe('BELLATOXEL.md');
            expect(resolveProductFilename('Bellatoxel')).toBe('BELLATOXEL.md');
            expect(resolveProductFilename('bELLATOXEL')).toBe('BELLATOXEL.md');
        });

        it('tolera espacios alrededor', () => {
            expect(resolveProductFilename('  Bellatoxel  ')).toBe('BELLATOXEL.md');
            expect(resolveProductFilename('\tBellatoxel\n')).toBe('BELLATOXEL.md');
        });

        it('alias cortos funcionan', () => {
            expect(resolveProductFilename('DMAE')).toBe('regenerativos.md');
            // "sofiderm" no está mapeado directo en map, pero resolve resolverá el primer match parcial que contenga sofiderm? No, resolveProductFilename solo hace exact, collapsed, noSpace matches contra el mapa.
            // Espera, miremos product-name-map.ts:
            // "sofiderm finelines": "SOFIDERM 1ml.md"
            // "sofiderm derm": "SOFIDERM 1ml.md"
            // "sofiderm deep": "SOFIDERM 1ml.md"
            // "sofiderm skin booster": "SOFIDERM SKIN BOOSTER.md"
            // "sofiderm wrinkle fighter": "SOFIDERM SKIN BOOSTER.md"
            // "sofiderm resurrection": "SOFIDERM SKIN BOOSTER.md"
            // Y no hay clave "sofiderm" sola. Así que resolveProductFilename('Sofiderm') devolverá null.
            expect(resolveProductFilename('Sofiderm')).toBeNull();
            expect(resolveProductFilename('Lipasa')).toBe('enzimas.md');
            expect(resolveProductFilename('Lidocaina')).toBe('LIDOCAINA.md');
            expect(resolveProductFilename('Glowpen')).toBe('Dermapen, agujas, aditamentos.md');
            expect(resolveProductFilename('PDO')).toBe('HILOS PDO.md');
        });

        it('alias en español funcionan', () => {
            expect(resolveProductFilename('Acido Hialuronico')).toBe('HYALURONIC ACID.md');
            expect(resolveProductFilename('Alcachofa')).toBe('ARTICHOKE.md');
            expect(resolveProductFilename('Cafeina')).toBe('CAFFEINE.md');
            expect(resolveProductFilename('Colagenasa')).toBe('enzimas.md');
            expect(resolveProductFilename('Hialuronidasa')).toBe('HYALURONIDASE LIQUID.md');
        });
    });

    // ═══════════════════════════════════════════════════
    // Productos inexistentes
    // ═══════════════════════════════════════════════════

    describe('productos desconocidos', () => {
        it('retorna null para productos que no existen', () => {
            expect(resolveProductFilename('XYZ-123')).toBeNull();
            expect(resolveProductFilename('Producto Inexistente')).toBeNull();
            expect(resolveProductFilename('')).toBeNull();
        });

        it('retorna null para strings vacíos o solo espacios', () => {
            expect(resolveProductFilename('')).toBeNull();
            expect(resolveProductFilename('   ')).toBeNull();
        });
    });
});
