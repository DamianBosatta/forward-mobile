import { shadowMd, shadowSm } from '../theme'

describe.each(['light', 'dark'] as const)('shadowSm (%s)', (esquema) => {
  it('es más suave que shadowMd: la tarjeta se separa del fondo sin competir con lo que flota', () => {
    expect(shadowSm[esquema].shadowOpacity).toBeLessThan(shadowMd[esquema].shadowOpacity)
    expect(shadowSm[esquema].elevation).toBeLessThan(shadowMd[esquema].elevation)
  })

  it('se nota: no es cero', () => {
    expect(shadowSm[esquema].shadowOpacity).toBeGreaterThan(0)
    expect(shadowSm[esquema].elevation).toBeGreaterThanOrEqual(1)
  })
})
