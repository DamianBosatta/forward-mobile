import { numeroDeCompra } from '../lib/numero'

describe('numeroDeCompra (9C)', () => {
  it('con número del servidor, C- y cinco cifras', () => {
    expect(numeroDeCompra({ id: 'aaaa1111-0000', numero: 232 })).toBe('C-00232')
    expect(numeroDeCompra({ id: 'aaaa1111-0000', numero: 123456 })).toBe('C-123456')
  })

  it('sin número (servidor anterior), los primeros 8 caracteres del id en mayúscula', () => {
    expect(numeroDeCompra({ id: 'aaaa1111-0000' })).toBe('AAAA1111')
    expect(numeroDeCompra({ id: 'aaaa1111-0000', numero: null })).toBe('AAAA1111')
  })
})
