import type { MotivoAutorizacionDetalle } from '@/libs/api-client/types'
import { motivosDe, textosDeMotivos } from '../lib/motivos'

const DETALLE: MotivoAutorizacionDetalle[] = [
  { motivo: 'DescuentoExcedeTope', texto: 'Detergente con descuento de 15 % (tope 10 %)' },
  { motivo: 'DescuentoExcedeTope', texto: 'Lavandina con descuento de 20 % (tope 10 %)' },
  { motivo: 'SuperaTopeCredito', texto: 'Supera el tope de crédito del cliente ($450.000,00)' },
]

describe('textosDeMotivos', () => {
  it('con detalle del servidor, una frase por ítem y en su orden (un motivo puede repetirse por línea)', () => {
    const r = textosDeMotivos(4 | 32, DETALLE)
    expect(r.map((m) => m.texto)).toEqual(DETALLE.map((d) => d.texto))
    expect(new Set(r.map((m) => m.clave)).size).toBe(3) // claves únicas para el render
  })

  it.each([[undefined], [null], [[]]])('sin detalle (%p) usa las frases de las banderas', (detalle) => {
    const r = textosDeMotivos(4 | 32, detalle as MotivoAutorizacionDetalle[] | null | undefined)
    expect(r.map((m) => m.texto)).toEqual(motivosDe(4 | 32).map((m) => m.texto))
    expect(r).toHaveLength(2)
  })

  it('un ítem sin texto no se muestra; si no queda ninguno, vuelve a las banderas', () => {
    const vacios = [{ motivo: 'SuperaTopeCredito', texto: '  ' }]
    expect(textosDeMotivos(32, vacios).map((m) => m.texto)).toEqual(['Supera el tope de crédito del cliente'])
    expect(textosDeMotivos(32, [...vacios, DETALLE[2]!]).map((m) => m.texto)).toEqual([DETALLE[2]!.texto])
  })

  it('sin banderas ni detalle no hay frases', () => {
    expect(textosDeMotivos(0, undefined)).toEqual([])
    expect(textosDeMotivos(null, null)).toEqual([])
  })
})
