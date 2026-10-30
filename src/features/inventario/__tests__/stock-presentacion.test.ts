import { chipDeFilaStock, textoMinimo, textoReservadas } from '../lib/stock-presentacion'

describe('chipDeFilaStock', () => {
  it('sin disponible dice "Sin stock", aunque el servidor lo marque en alerta', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 0, enAlerta: true })).toEqual({ estado: 'anulado', label: 'Sin stock' })
  })

  it('en alerta (lo decide el servidor) dice "En alerta"', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 8, enAlerta: true })).toEqual({ estado: 'porAutorizar', label: 'En alerta' })
  })

  it('con stock de sobra dice "Hay stock"', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 50, enAlerta: false })).toEqual({ estado: 'entregado', label: 'Hay stock' })
  })
})

describe('textos del renglón', () => {
  it('el mínimo solo se escribe si existe', () => {
    expect(textoMinimo(24)).toBe('Mín. 24')
    expect(textoMinimo(0)).toBeNull()
  })

  it('reservadas y por ingresar van siempre, con 0 incluido (lámina Stock)', () => {
    expect(textoReservadas(6, 48)).toBe('Reservado 6 · Por ingresar 48')
    expect(textoReservadas(0, 0)).toBe('Reservado 0 · Por ingresar 0')
  })
})
