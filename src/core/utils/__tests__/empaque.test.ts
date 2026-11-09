import { nivelesDeEmpaque, presentacionEmpaque, unidadesPorPack } from '../empaque'

const FICHA = { ventaMinimaUnidades: 8, bultoContenido: 288, bultoMadreContenido: 10 }

describe('empaque del producto (única regla de compra y venta)', () => {
  it('ofrece Unidad, Pack, Bulto y Bulto madre con sus factores; el pack no multiplica al bulto', () => {
    expect(nivelesDeEmpaque(FICHA)).toEqual([
      { unidad: 'Unidad', unidades: 1 },
      { unidad: 'Pack', unidades: 8 },
      { unidad: 'Bulto', unidades: 288 },
      { unidad: 'BultoMadre', unidades: 2880 },
    ])
  })

  it.each([
    ['2 packs', 'Pack', 2, 16],
    ['1 bulto', 'Bulto', 1, 288],
    ['1 bulto madre', 'BultoMadre', 1, 2880],
  ])('%s equivalen a unidades esperadas', (_n, unidad, cantidad, esperado) => {
    const factor = nivelesDeEmpaque(FICHA).find((o) => o.unidad === unidad)!.unidades
    expect(cantidad * factor).toBe(esperado)
  })

  it('sin pack (1, 0 o sin dato) no se ofrece Pack', () => {
    for (const v of [1, 0, null, undefined]) {
      expect(nivelesDeEmpaque({ ventaMinimaUnidades: v, bultoContenido: 12 }).map((o) => o.unidad)).toEqual(['Unidad', 'Bulto'])
      expect(unidadesPorPack(v)).toBeNull()
    }
  })

  it('bulto madre sin bulto cuenta unidades; sin ficha solo Unidad', () => {
    expect(nivelesDeEmpaque({ bultoContenido: 1, bultoMadreContenido: 40 })).toEqual([
      { unidad: 'Unidad', unidades: 1 },
      { unidad: 'BultoMadre', unidades: 40 },
    ])
    expect(nivelesDeEmpaque(undefined)).toEqual([{ unidad: 'Unidad', unidades: 1 }])
  })

  it('presenta el empaque completo', () => {
    expect(presentacionEmpaque({ ventaMinimaUnidades: 8, bultoContenido: 288, bultoMadreContenido: 10 })).toEqual([
      'Pack x8', 'Bulto 36 packs · 288 u.', 'B. madre 10 bultos · 2.880 u.',
    ])
    expect(presentacionEmpaque({ bultoContenido: 12 })).toEqual(['Bulto 12 u.'])
  })
})
