import { chipDeFilaStock, textoMinimo, textoReservadas } from '../lib/stock-presentacion'

describe('chipDeFilaStock', () => {
  it('sin disponible dice "Sin stock", aunque el servidor lo marque en alerta', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 0, enAlerta: true })).toEqual({ estado: 'anulado', label: 'Sin stock' })
  })

  it('en alerta (lo decide el servidor) dice "Poco stock"', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 8, enAlerta: true })).toEqual({ estado: 'pendiente', label: 'Poco stock' })
  })

  it('con stock de sobra no lleva chip', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 50, enAlerta: false })).toBeNull()
  })
})

describe('textos del renglón', () => {
  it('el mínimo solo se escribe si existe', () => {
    expect(textoMinimo(24)).toBe('mínimo 24')
    expect(textoMinimo(0)).toBeNull()
  })

  it('las reservadas van en singular, plural o "sin reservas"', () => {
    expect(textoReservadas(6)).toBe('6 reservadas')
    expect(textoReservadas(1)).toBe('1 reservada')
    expect(textoReservadas(0)).toBe('sin reservas')
  })
})
