import { chipDeFilaStock, textoMinimo, textoReservadas } from '../lib/stock-presentacion'

describe('chipDeFilaStock', () => {
  it('sin disponible dice "Sin stock", aunque el servidor lo marque en alerta', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 0, enAlerta: true })).toEqual({ estado: 'anulado', label: 'Sin stock' })
  })

  it('en alerta (lo decide el servidor) dice "En alerta"', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 8, enAlerta: true })).toEqual({ estado: 'porAutorizar', label: 'En alerta' })
  })

  it('con stock de sobra dice "Con stock" (etiqueta de la web)', () => {
    expect(chipDeFilaStock({ cantidadDisponible: 50, enAlerta: false })).toEqual({ estado: 'entregado', label: 'Con stock' })
  })
})

describe('textos del renglón', () => {
  it('el mínimo solo se escribe si existe', () => {
    expect(textoMinimo(24)).toBe('Mín. 24')
    expect(textoMinimo(0)).toBeNull()
  })

  it('reservado y por entrar van siempre, con 0 incluido; la web nunca dice "Virtual" ni "Por ingresar"', () => {
    expect(textoReservadas(6, 48)).toBe('Reservado 6 · Por entrar 48')
    expect(textoReservadas(0, 0)).toBe('Reservado 0 · Por entrar 0')
  })
})
