import { mensajeWhatsAppVenta, normalizarTelefonoWhatsappAr, urlWhatsAppVenta } from '../whatsappVenta'

describe('WhatsApp de una venta (web: telefono-whatsapp.ts y mensaje-whatsapp-venta.ts)', () => {
  it.each([
    ['+54 9 11 1234-5678', '5491112345678'],
    ['+54 11 1234-5678', '5491112345678'],
    ['011 15-1234-5678', '5491112345678'],
    ['11 15-1234-5678', '5491112345678'],
    ['011 4321-5678', '5491143215678'],
  ])('normaliza %s', (entrada, salida) => expect(normalizarTelefonoWhatsappAr(entrada)).toBe(salida))

  it('sin teléfono válido no hay enlace', () => {
    expect(normalizarTelefonoWhatsappAr(null)).toBeNull()
    expect(normalizarTelefonoWhatsappAr('123')).toBeNull()
    expect(urlWhatsAppVenta('abc', 'hola')).toBeNull()
  })

  it('el mensaje dice tipo, número y total, sin enlaces', () => {
    expect(mensajeWhatsAppVenta({ tipoOperacion: 2, id: 'abcdef123456', codigoPedido: 'A00419', total: '$ 88.738,89' }))
      .toBe('Hola! Te comparto el resumen de tu venta #A00419. Total: $ 88.738,89.')
    expect(mensajeWhatsAppVenta({ tipoOperacion: 1, id: 'abcdef123456', codigoPedido: null, total: '$ 1,00' }))
      .toBe('Hola! Te comparto el resumen de tu presupuesto #ABCDEF12. Total: $ 1,00.')
  })

  it('el enlace lleva el número y el texto codificado', () => {
    expect(urlWhatsAppVenta('011 4321-5678', 'Hola! Total: $ 5')).toBe('https://wa.me/5491143215678?text=Hola!%20Total%3A%20%24%205')
  })
})
