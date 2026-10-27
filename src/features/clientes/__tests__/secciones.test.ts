import { seccionesPorLetra } from '../lib/secciones'
import { clienteDeLista } from '../__testing__/ayuda'

const con = (id: string, direccion: string | undefined) => clienteDeLista({ id, direccion })

describe('seccionesPorLetra', () => {
  it('agrupa por la primera letra de la dirección, sin tildes ni mayúsculas, en el orden del servidor', () => {
    const r = seccionesPorLetra([con('1', 'Álvarez 12'), con('2', 'alsina 3'), con('3', 'Belgrano 1')])
    expect(r.map(s => [s.title, s.data.map(c => c.id)])).toEqual([['A', ['1', '2']], ['B', ['3']]])
  })

  it('lo que no empieza con una letra va bajo "#" y los sin dirección en una sección final', () => {
    const r = seccionesPorLetra([con('1', '25 de Mayo 5'), con('2', 'Belgrano 1'), con('3', undefined), con('4', '  ')])
    expect(r.map(s => [s.title, s.data.map(c => c.id)])).toEqual([
      ['#', ['1']], ['B', ['2']], ['Sin dirección', ['3', '4']],
    ])
  })

  it('sin clientes no hay secciones', () => {
    expect(seccionesPorLetra([])).toEqual([])
  })
})
