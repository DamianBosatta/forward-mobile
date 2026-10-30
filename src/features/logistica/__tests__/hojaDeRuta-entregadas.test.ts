import { EstadoParada, type ParadaDto } from '@/libs/api-client/types'
import { resumenRuta } from '../consola/hojaDeRuta'

const p = (orden: number, estado: ParadaDto['estado']) => ({ id: `p${orden}`, orden, estado }) as ParadaDto

describe('resumenRuta: entregadas', () => {
  it('una parada NoEntregado no cuenta como entregada (0 de 3), pero sí como reportada', () => {
    const r = resumenRuta([p(1, EstadoParada.NoEntregado), p(2, EstadoParada.Pendiente), p(3, EstadoParada.Pendiente)])
    expect(r.entregadas).toBe(0)
    expect(r.hechas).toBe(1)
    expect(r.total).toBe(3)
  })

  it('cuenta solo las Entregado', () => {
    const r = resumenRuta([p(1, EstadoParada.Entregado), p(2, EstadoParada.NoEntregado), p(3, EstadoParada.Pendiente)])
    expect(r.entregadas).toBe(1)
  })
})
