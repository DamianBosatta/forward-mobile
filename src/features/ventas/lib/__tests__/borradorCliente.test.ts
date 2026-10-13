import { identidadDeBorrador } from '../borradorCliente'
import type { BorradorVenta } from '@/libs/api-client/ventas'

const base: BorradorVenta = {
  id: 'b1', version: 1, clienteId: 'c', clienteNombre: 'Almacén Luis SRL', depositoId: 'd',
  fechaModificacion: '2026-10-12T15:00:00Z', cantidadLineas: 3,
}

// formatImporte separa el signo (o el código de moneda) de la cifra con un espacio duro, U+00A0.
describe('identidadDeBorrador', () => {
  it('servidor nuevo: la dirección es el título, la razón social el subtítulo y el total sale formateado', () => {
    expect(identidadDeBorrador({ ...base, clienteDireccion: ' Brandsen 3314 ', totalAmount: 15250.5, totalCurrency: 'ARS' }))
      .toEqual({ titulo: 'Brandsen 3314', subtitulo: 'Almacén Luis SRL', total: '$ 15.250,50' })
  })

  it('un total en dólares lleva el código de la moneda', () => {
    expect(identidadDeBorrador({ ...base, clienteDireccion: 'Brandsen 3314', totalAmount: 80, totalCurrency: 'USD' }).total)
      .toBe('USD 80,00')
  })

  it('sin dirección (null, vacía o solo espacios) queda la razón social sola, y el total se mantiene', () => {
    for (const clienteDireccion of [null, '', '   ']) {
      expect(identidadDeBorrador({ ...base, clienteDireccion, totalAmount: 0, totalCurrency: 'ARS' }))
        .toEqual({ titulo: 'Almacén Luis SRL', subtitulo: null, total: '$ 0,00' })
    }
  })

  it('servidor anterior (sin los campos nuevos): la razón social sola y sin total', () => {
    expect(identidadDeBorrador(base)).toEqual({ titulo: 'Almacén Luis SRL', subtitulo: null, total: null })
  })
})
