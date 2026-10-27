import { buildAutorizarPayload } from '../autorizar-venta'

describe('buildAutorizarPayload — includes ventaId, version, and razon only', () => {
  const base = {
    ventaId: 'venta-123',
    version: 5,
    razon: 'Cliente estratégico, cierre de stock',
  }

  it('sin razón (o en blanco) la manda en null: el servidor rechaza una razón vacía', () => {
    expect(buildAutorizarPayload({ ventaId: 'v', version: 1, razon: '   ' }).razon).toBeNull()
    expect(buildAutorizarPayload({ ventaId: 'v', version: 1 }).razon).toBeNull()
  })

  it('includes razon in the payload', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload.razon).toBe('Cliente estratégico, cierre de stock')
  })

  it('includes ventaId and version', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload.ventaId).toBe('venta-123')
    expect(payload.version).toBe(5)
  })

  it('does NOT include usuarioId (server derives identity from the JWT token)', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload).not.toHaveProperty('usuarioId')
  })

  it('does NOT include isAdminUser (server derives role from the JWT token)', () => {
    const payload = buildAutorizarPayload(base)
    expect(payload).not.toHaveProperty('isAdminUser')
  })

  it('trims whitespace from razon', () => {
    const payload = buildAutorizarPayload({ ...base, razon: '  acuerdo comercial  ' })
    expect(payload.razon).toBe('acuerdo comercial')
  })
})
