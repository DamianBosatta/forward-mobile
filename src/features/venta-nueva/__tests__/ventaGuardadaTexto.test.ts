import { entregaTexto, resumenDeLineas } from '../lib/ventaGuardada'

describe('V8 listo: textos del resumen', () => {
  it('la entrega: el día de la semana y la fecha, tomando el día guardado sin zonas horarias', () => {
    expect(entregaTexto('2026-10-22T00:00:00')).toBe('entrega el jueves 22/10')
    expect(entregaTexto('2026-10-20')).toBe('entrega el martes 20/10')
    expect(entregaTexto('2026-01-04T03:00:00Z')).toBe('entrega el domingo 04/01')
  })
  it('sin fecha de entrega (retiro en el local) no inventa una', () => {
    expect(entregaTexto(null)).toBeNull()
    expect(entregaTexto(undefined)).toBeNull()
    expect(entregaTexto('')).toBeNull()
  })
  it('productos y unidades, en singular cuando es uno', () => {
    expect(resumenDeLineas([{ cantidad: 12 }, { cantidad: 6 }, { cantidad: 16 }])).toBe('3 productos · 34 unidades')
    expect(resumenDeLineas([{ cantidad: 1 }])).toBe('1 producto · 1 unidad')
  })
})
