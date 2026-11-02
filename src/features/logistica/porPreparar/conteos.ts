import { resolverEstadoVenta } from '@/libs/reglas/estados'
import type { ConteosPreparacion } from '@/libs/api-client/logistica'

export interface ConteosDePestanas {
  pendientes: number
  noEntregados: number
}

/**
 * Cantidades de las dos pestañas a partir de las columnas del servidor (`clave` = nombre del
 * EstadoVenta; X11: se resuelve por nombre). "No entregados" es la columna NoEntregada; "Pendientes",
 * las demás. El filtro de estado es del teléfono: deja solo la columna de ese estado, como la lista.
 * Sin respuesta devuelve null: la pestaña va sin número, nunca con uno equivocado.
 */
export function conteosDePestanas(conteos: ConteosPreparacion | undefined, estadoFiltrado: number | null): ConteosDePestanas | null {
  if (!conteos) return null
  const filtrado = estadoFiltrado === null ? null : resolverEstadoVenta(estadoFiltrado)?.nombre
  const r: ConteosDePestanas = { pendientes: 0, noEntregados: 0 }
  for (const col of conteos.columnas) {
    const nombre = resolverEstadoVenta(col.clave)?.nombre
    if (filtrado !== null && nombre !== filtrado) continue
    if (nombre === 'NoEntregada') r.noEntregados += col.cantidad
    else r.pendientes += col.cantidad
  }
  return r
}

export const etiquetaConConteo = (label: string, n: number | undefined) => (n === undefined ? label : `${label} (${n})`)
