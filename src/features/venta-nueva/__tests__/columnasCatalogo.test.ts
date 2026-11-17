import { columnasDelCatalogo } from '../lib/columnasCatalogo'

describe('columnasDelCatalogo', () => {
  it('teléfono: una columna aunque haya ancho', () => {
    expect(columnasDelCatalogo('phone', 390)).toBe(1)
  })
  it('tablet vertical: dos columnas', () => {
    expect(columnasDelCatalogo('tabletPortrait', 800)).toBe(2)
  })
  it('tablet horizontal 1280 dp con menú (170) y panel (360): la grilla mide 750 y entran 2, no 3', () => {
    expect(columnasDelCatalogo('tabletLandscape', 750)).toBe(2)
  })
  it('tablet horizontal ancha: 3 columnas cuando entran', () => {
    expect(columnasDelCatalogo('tabletLandscape', 1100)).toBe(3)
  })
  it('tablet horizontal angosta: nunca menos de una', () => {
    expect(columnasDelCatalogo('tabletLandscape', 200)).toBe(1)
  })
  it('sin medir todavía: criterio por formato', () => {
    expect(columnasDelCatalogo('tabletLandscape', null)).toBe(3)
  })
})
