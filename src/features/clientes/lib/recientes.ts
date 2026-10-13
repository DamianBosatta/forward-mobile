import { storage } from '@/core/utils/storage'

/**
 * Lo mínimo para nombrar a un cliente elegido. Es lo único que se guarda en el teléfono como
 * "reciente": nada de CUIT, teléfono ni saldo. Los recientes del servidor (`clientes-recientes`)
 * vienen con la misma forma y se mezclan con estos (`fusionarRecientes`).
 */
export interface ClienteElegido {
  id: string
  direccion?: string | null
  nombreFantasia?: string | null
  nombreContacto?: string | null
  razonSocial?: string | null
}

export const MAX_RECIENTES = 5
const clave = (usuarioId: string) => `clientes-recientes:${usuarioId}`

export function aElegido(c: ClienteElegido): ClienteElegido {
  return { id: c.id, direccion: c.direccion, nombreFantasia: c.nombreFantasia, nombreContacto: c.nombreContacto, razonSocial: c.razonSocial }
}

export function leerRecientes(usuarioId: string | undefined): ClienteElegido[] {
  if (!usuarioId) return []
  try {
    const lista: unknown = JSON.parse(storage.getString(clave(usuarioId)) ?? '[]')
    return Array.isArray(lista) ? lista.filter((c): c is ClienteElegido => typeof c?.id === 'string') : []
  } catch {
    return []
  }
}

/** Pone al cliente primero (sin repetir) y deja los últimos MAX_RECIENTES de este usuario. */
export function guardarReciente(usuarioId: string | undefined, cliente: ClienteElegido): void {
  if (!usuarioId) return
  const lista = [aElegido(cliente), ...leerRecientes(usuarioId).filter(c => c.id !== cliente.id)].slice(0, MAX_RECIENTES)
  storage.set(clave(usuarioId), JSON.stringify(lista))
}

export function quitarReciente(usuarioId: string | undefined, id: string): void {
  if (!usuarioId) return
  storage.set(clave(usuarioId), JSON.stringify(leerRecientes(usuarioId).filter(c => c.id !== id)))
}

/**
 * Lo que muestra el selector: primero los recientes del servidor (que viajan entre dispositivos y
 * ya vienen filtrados: activos y de la cartera del usuario), después los del teléfono que el
 * servidor no trajo, sin repetir por id y hasta `MAX_RECIENTES`.
 *
 * - Sin respuesta del servidor (`undefined`: 404, sin red, error) quedan los del teléfono tal cual.
 * - Un cliente que está en las dos listas sale una sola vez, con los datos del servidor (más frescos).
 * - Un reciente del teléfono que el servidor no trae se conserva: su ausencia no prueba que se haya
 *   dado de baja (puede ser un cliente elegido sin venta todavía, o quedar fuera del tope). Si ya no
 *   existe, se detecta al elegirlo y se quita ahí (`SeleccionarClienteSheet`).
 * - `descartados`: ids que ya se comprobó que no están disponibles; no se muestran de ninguna lista.
 */
export function fusionarRecientes(
  servidor: ClienteElegido[] | undefined,
  locales: ClienteElegido[],
  descartados: readonly string[] = [],
): ClienteElegido[] {
  const vistos = new Set<string>(descartados)
  const fusion: ClienteElegido[] = []
  // Una respuesta que no es una lista (servidor raro) cuenta como "sin respuesta".
  for (const c of [...(Array.isArray(servidor) ? servidor : []), ...locales]) {
    if (vistos.has(c.id)) continue
    vistos.add(c.id)
    fusion.push(aElegido(c))
  }
  return fusion.slice(0, MAX_RECIENTES)
}
