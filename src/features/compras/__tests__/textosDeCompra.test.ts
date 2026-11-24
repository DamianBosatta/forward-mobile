import { diaDeCompraTexto } from '../lib/fecha'
import { FALTAN_DATOS_DE_COMPRA, AVISO_FALTAN_DATOS } from '@/features/proveedores/lib/proveedor'

describe('diaDeCompraTexto (MC-6: un solo formato de día, el de Argentina)', () => {
  it('formatea dd/mm/aaaa con el día de Argentina, no el de UTC', () => {
    expect(diaDeCompraTexto('2026-11-20T01:30:00.000Z')).toBe('19/11/2026')
  })
  it('sin fecha válida devuelve null', () => {
    expect(diaDeCompraTexto(null)).toBeNull()
    expect(diaDeCompraTexto('no es fecha')).toBeNull()
  })
})

describe('FALTAN_DATOS_DE_COMPRA (MC-14: una sola frase)', () => {
  it('el aviso largo empieza con la misma frase que la etiqueta', () => {
    expect(AVISO_FALTAN_DATOS.startsWith(FALTAN_DATOS_DE_COMPRA)).toBe(true)
  })
})
