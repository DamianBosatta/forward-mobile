import { condicionBreve, saldoDelProveedor } from '../lib/proveedor'

describe('condicionBreve: cómo se le paga al proveedor, en pocas palabras', () => {
  it.each([
    [{ tipo: 'Contado' as const }, 'Contado'],
    [{ tipo: 'DiasDesdeFactura' as const, dias: 30 }, '30 días de factura'],
    [{ tipo: 'DiasDesdeEntrega' as const, dias: 15 }, '15 días de entrega'],
    [{ tipo: 'DiaFijoDelMes' as const, diaDelMes: 10 }, 'el día 10 de cada mes'],
  ])('%j -> %s', (cp, texto) => {
    expect(condicionBreve(cp)).toBe(texto)
  })

  it('sin condición cargada no inventa un contado: devuelve null', () => {
    expect(condicionBreve(undefined)).toBeNull()
    expect(condicionBreve({})).toBeNull()
  })
})

describe('saldoDelProveedor: saldo positivo es lo que le debemos (misma convención que la web)', () => {
  it('positivo: le debemos', () => expect(saldoDelProveedor(710430)).toEqual({ etiqueta: 'Le debemos', monto: 710430 }))
  it('negativo: a favor, en positivo', () => expect(saldoDelProveedor(-500)).toEqual({ etiqueta: 'A favor', monto: 500 }))
  it('cero: al día', () => expect(saldoDelProveedor(0)).toEqual({ etiqueta: 'Al día', monto: 0 }))
})
