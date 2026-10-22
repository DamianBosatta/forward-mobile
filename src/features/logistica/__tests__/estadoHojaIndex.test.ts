// L-33: la lista de logística muestra las mismas etiquetas y colores que antes.
jest.mock('@/libs/theme', () => ({ BRAND: { violet: 'V', blue: 'B', green: 'G', red: 'R' }, tokens: {}, useColors: () => ({}) }))
jest.mock('@/features/logistica/components/ChoferDashboard', () => ({ ChoferDashboard: () => null }))

import { detalleEstadoHoja } from '../../../../app/(tabs)/logistica/index'

const C = { primary: 'P', textDisabled: 'X', surface2: 'S2' } as never

describe('detalleEstadoHoja', () => {
  it.each([
    [1, 'PROGRAMADA', 'V'], [5, 'DOCUMENTADA', 'B'], [2, 'EN CURSO', 'P'], [3, 'FINALIZADA', 'G'], [4, 'CANCELADA', 'R'],
  ])('%s -> %s', (estado, label, color) => {
    expect(detalleEstadoHoja(estado, C)).toEqual({ label, color, bgColor: color + '15' })
  })
  it('un estado desconocido sigue como DESCONOCIDO', () => {
    expect(detalleEstadoHoja(99, C)).toEqual({ label: 'DESCONOCIDO', color: 'X', bgColor: 'S2' })
  })
})
