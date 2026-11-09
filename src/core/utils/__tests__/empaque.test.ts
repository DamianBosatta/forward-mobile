import { nivelDeUnidades, nivelInicial, nivelesDeEmpaque, pasoDeUnidad, presentacionEmpaque, unidadesPorPack } from '../empaque'
import { presentacionDe } from '@/features/venta-nueva/lib/presentacion'

const FICHA = { ventaMinimaUnidades: 8, bultoContenido: 288, bultoMadreContenido: 10 }

describe('empaque del producto (única regla de compra y venta)', () => {
  it('ofrece Unidad, Bulto y Bulto madre con sus factores, nunca un nivel Pack (igual que venta)', () => {
    expect(nivelesDeEmpaque(FICHA)).toEqual([
      { unidad: 'Unidad', unidades: 1 },
      { unidad: 'Bulto', unidades: 288 },
      { unidad: 'BultoMadre', unidades: 2880 },
    ])
  })

  it.each([
    ['1 bulto', 'Bulto', 1, 288],
    ['1 bulto madre', 'BultoMadre', 1, 2880],
  ])('%s equivalen a unidades esperadas', (_n, unidad, cantidad, esperado) => {
    const factor = nivelesDeEmpaque(FICHA).find((o) => o.unidad === unidad)!.unidades
    expect(cantidad * factor).toBe(esperado)
  })

  it('un bulto o bulto madre que no es múltiplo del pack no se ofrece', () => {
    expect(nivelesDeEmpaque({ ventaMinimaUnidades: 8, bultoContenido: 12, bultoMadreContenido: 3 }).map((o) => o.unidad)).toEqual(['Unidad'])
    expect(nivelesDeEmpaque({ ventaMinimaUnidades: 8, bultoContenido: 12, bultoMadreContenido: 2 }).map((o) => o.unidad)).toEqual(['Unidad', 'BultoMadre'])
  })

  it('los niveles de compra coinciden con los modos de venta del mismo producto', () => {
    for (const f of [FICHA, { ventaMinimaUnidades: 6, bultoContenido: 10 }, { ventaMinimaUnidades: 6, bultoContenido: 12 }, { bultoContenido: 12 }]) {
      const venta = presentacionDe({ ...f, fraccionMinimaVenta: 'Unidad', ventaMinimaUnidades: f.ventaMinimaUnidades ?? 1 } as never)
      expect(nivelesDeEmpaque(f).some((n) => n.unidad === 'Bulto')).toBe(venta.modos.includes('bultos'))
      expect(pasoDeUnidad(f)).toBe(venta.paso.unidades)
    }
  })

  it('el paso de Unidad es el pack; abre en Bulto si lo hay, si no en Unidad', () => {
    expect(pasoDeUnidad(FICHA)).toBe(8)
    expect(pasoDeUnidad({ bultoContenido: 12 })).toBe(1)
    expect(nivelInicial(FICHA)).toBe('Bulto')
    expect(nivelInicial({ ventaMinimaUnidades: 8, bultoContenido: 12 })).toBe('Unidad')
  })

  it('una cantidad en unidades se relee en el mayor nivel cuyo factor la divide', () => {
    expect(nivelDeUnidades(FICHA, 16)).toEqual({ unidad: 'Unidad', cantidad: 16, unidades: 1 })
    expect(nivelDeUnidades(FICHA, 576)).toEqual({ unidad: 'Bulto', cantidad: 2, unidades: 288 })
    expect(nivelDeUnidades(FICHA, 5760)).toEqual({ unidad: 'BultoMadre', cantidad: 2, unidades: 2880 })
  })

  it('sin pack (1, 0 o sin dato) no hay paso y se ofrece Bulto', () => {
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
