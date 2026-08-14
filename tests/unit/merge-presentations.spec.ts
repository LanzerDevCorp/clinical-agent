import { describe, expect, it } from 'vitest'

import { mergePresentations } from '@/scripts/lib/merge-presentations'

const liofilizado = {
  canonicalName: 'Vial Liofilizado 1500 UI',
  status: 'activa',
  contraindications: [1, 2],
  protocols: [38],
}

const liquida = {
  canonicalName: 'Caja 5 Viales 10 ml',
  status: 'activa',
  contraindications: [3],
  protocols: [39],
}

describe('mergePresentations', () => {
  it('empareja por nombre, no por posición', () => {
    // El defecto que corrompió CLH LIPASE: dos fichas del mismo producto
    // comercial, y la segunda se fusionó con la primera por estar ambas en el
    // índice 0. El liofilizado terminó apuntando al protocolo de la líquida.
    const merged = mergePresentations([liofilizado], [liquida])

    expect(merged).toHaveLength(2)
    expect(merged.map((p) => p.canonicalName)).toEqual([
      'Vial Liofilizado 1500 UI',
      'Caja 5 Viales 10 ml',
    ])
  })

  it('conserva el protocolo de cada presentación', () => {
    const merged = mergePresentations([liofilizado], [liquida])

    expect(merged[0].protocols).toEqual([38])
    expect(merged[1].protocols).toEqual([39])
  })

  it('fusiona las relaciones cuando la presentación es la misma', () => {
    const incoming = { ...liofilizado, contraindications: [2, 9] }
    const merged = mergePresentations([liofilizado], [incoming])

    expect(merged).toHaveLength(1)
    expect(merged[0].contraindications).toEqual([1, 2, 9])
  })

  it('ignora mayúsculas y acentos al emparejar', () => {
    const incoming = { ...liofilizado, canonicalName: 'vial liofilizado 1500 ui' }

    expect(mergePresentations([liofilizado], [incoming])).toHaveLength(1)
  })

  it('conserva una presentación existente que el lote nuevo no trae', () => {
    // Puede ser una presentación que la doctora agregó a mano. El lote no la
    // menciona, y eso no es motivo para borrarla.
    const merged = mergePresentations([liofilizado, liquida], [liofilizado])

    expect(merged).toHaveLength(2)
    expect(merged.map((p) => p.canonicalName)).toContain('Caja 5 Viales 10 ml')
  })

  it('conserva el estado existente en vez de pisarlo', () => {
    // Una presentación marcada descontinuada a mano sigue descontinuada.
    const discontinued = { ...liofilizado, status: 'descontinuada' }
    const merged = mergePresentations([discontinued], [liofilizado])

    expect(merged[0].status).toBe('descontinuada')
  })

  it('agrega todas las presentaciones nuevas cuando no existe ninguna', () => {
    const merged = mergePresentations([], [liofilizado, liquida])

    expect(merged).toHaveLength(2)
  })

  it('deja la lista existente intacta si el lote no trae presentaciones', () => {
    const merged = mergePresentations([liofilizado], [])

    expect(merged).toEqual([liofilizado])
  })
})
