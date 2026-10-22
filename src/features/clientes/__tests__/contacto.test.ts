import { urlLlamar, urlWhatsApp } from '../lib/contacto'

describe('urlLlamar', () => {
  it('deja solo dígitos y el +', () => {
    expect(urlLlamar('(221) 555-0182')).toBe('tel:2215550182')
    expect(urlLlamar('+54 221 555 0182')).toBe('tel:+542215550182')
  })
})

describe('urlWhatsApp (mismo criterio que el detalle de venta: prefijo 54)', () => {
  it('agrega el 54 si no lo tiene', () => {
    expect(urlWhatsApp('221 555-0182')).toBe('https://wa.me/542215550182')
  })

  it('no lo duplica si ya lo tiene', () => {
    expect(urlWhatsApp('+54 221 555 0182')).toBe('https://wa.me/542215550182')
  })

  it('sin teléfono no hay enlace', () => {
    expect(urlWhatsApp('')).toBeNull()
    expect(urlWhatsApp('   ')).toBeNull()
    expect(urlWhatsApp(undefined)).toBeNull()
  })
})
