import { EstadoParada, type ParadaDto } from '@/libs/api-client/types'
import type { AccionEnCola } from './colaConsola'

/**
 * Las paradas como las ve el chofer: lo que reportó sin señal y todavía no salió ya cuenta como hecho (la parada pasa
 * a "Hechas" y el progreso avanza), aunque el servidor —que no lo sabe todavía— la siga mandando pendiente.
 * Lo ya reportado en el servidor manda; las acciones para revisar (el servidor las rechazó) no se dan por hechas.
 */
export function conAccionesEnCola<T extends ParadaDto>(detalles: T[], acciones: AccionEnCola[]): T[] {
  const esperando = new Map(acciones.filter((a) => a.estado.tipo === 'esperando').map((a) => [a.paradaId, a]))
  if (esperando.size === 0) return detalles
  return detalles.map((p) => {
    const a = esperando.get(p.id)
    if (!a || p.estado === EstadoParada.Entregado || p.estado === EstadoParada.NoEntregado) return p
    return { ...p, estado: a.tipo === 'entrega' ? EstadoParada.Entregado : EstadoParada.NoEntregado }
  })
}
