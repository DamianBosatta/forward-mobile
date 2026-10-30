import { nombreDeEmpaque, textoDeLinea, type LineaCompra } from '../lib/lineaCompra'

const linea = (p: Partial<LineaCompra>): LineaCompra => ({ productoId: 'p', nombre: 'P', cantidad: 1, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: 10, ...p })

describe('textoDeLinea', () => {
  it('por unidad dice solo las unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 240 }))).toBe('240 u')
  })
  it('por bulto dice los bultos, lo que trae cada uno y las unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 20, unidad: 'Bulto', unidadesPorUnidad: 12 }))).toBe('20 bultos × 12 = 240 u')
  })
  it('por bulto madre dice bultos madre', () => {
    expect(textoDeLinea(linea({ cantidad: 5, unidad: 'BultoMadre', unidadesPorUnidad: 48 }))).toBe('5 bultos madre × 48 = 240 u')
  })
  it('un bulto de una unidad se dice como unidades', () => {
    expect(textoDeLinea(linea({ cantidad: 3, unidad: 'Bulto', unidadesPorUnidad: 1 }))).toBe('3 u')
  })
})

describe('nombreDeEmpaque', () => {
  it('singular y plural de cada empaque', () => {
    expect(nombreDeEmpaque('BultoMadre')).toBe('Bulto madre')
    expect(nombreDeEmpaque('Bulto', true)).toBe('Bultos')
  })
})
