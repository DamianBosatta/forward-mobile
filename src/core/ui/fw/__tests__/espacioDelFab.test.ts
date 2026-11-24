import { ALTO_FAB, espacioBajoElFab } from '../espacioDelFab'

describe('espacioBajoElFab (MC-8/MC-26: la última tarjeta no queda tapada por el botón flotante)', () => {
  it('deja libre el alto del botón, su separación del borde y un respiro', () => {
    expect(espacioBajoElFab(0)).toBeGreaterThanOrEqual(ALTO_FAB + 24)
    expect(espacioBajoElFab(0)).toBe(96)
  })
  it('suma el inset inferior', () => {
    expect(espacioBajoElFab(34)).toBe(espacioBajoElFab(0) + 34)
  })
})
