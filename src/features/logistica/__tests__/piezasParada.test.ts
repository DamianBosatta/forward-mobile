import { leerEtiqueta, piezasDeParada, textoPiezas, tituloPieza } from '../consola/piezasParada'

describe('piezas de la parada (adaptador TODO API)', () => {
  it('sin etiquetas del servidor no hay escaneo: etiquetas es null y el total sale del recuento', () => {
    expect(piezasDeParada({ cantidadBultos: 3 })).toEqual({ total: 3, etiquetas: null, numeros: [] })
  })

  it('un recuento inválido se degrada a 0 piezas', () => {
    expect(piezasDeParada({ cantidadBultos: Number.NaN }).total).toBe(0)
    expect(piezasDeParada({ cantidadBultos: -2 }).total).toBe(0)
  })

  it('el término es "pieza(s)", nunca "bulto(s)"', () => {
    expect(textoPiezas(1)).toBe('1 pieza')
    expect(textoPiezas(3)).toBe('3 piezas')
    expect(textoPiezas(3)).not.toMatch(/bulto/i)
  })

  it('titula cada pieza con su etiqueta si existe', () => {
    expect(tituloPieza(1, 3, '#A-4822')).toBe('Pieza 2 de 3 · #A-4822')
    expect(tituloPieza(0, 3)).toBe('Pieza 1 de 3')
  })

  it('lectura de etiqueta: leída, repetida o de otro cliente', () => {
    const etiquetas = ['#A-4821', '#A-4822']
    expect(leerEtiqueta(etiquetas, new Set(), ' #a-4822 ')).toEqual({ tipo: 'leida', indice: 1 })
    expect(leerEtiqueta(etiquetas, new Set([1]), '#A-4822')).toEqual({ tipo: 'repetida', indice: 1 })
    expect(leerEtiqueta(etiquetas, new Set(), '#Z-1')).toEqual({ tipo: 'ajena' })
  })
})
