import { storage } from '@/core/utils/storage'

/**
 * Lo mínimo para nombrar a un cliente elegido. Es lo único que se guarda en el teléfono como
 * "reciente": nada de CUIT, teléfono ni saldo (no hay endpoint de recientes; ver BACKLOG-9B.md).
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
