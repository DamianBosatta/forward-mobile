import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

/**
 * Sentry privacy rules (SEG-06, OPS-05): breadcrumbs and events never carry a query string (search terms typed by
 * the user), and the only user data attached is the opaque user id (no name, email or username).
 */

const QUERY_STRING = /\?\S*/g
const sinQuery = (texto: string): string => texto.replace(QUERY_STRING, '?<redacted>')

const LIMPIAR_EN_MIGAS = ['url', 'from', 'to'] as const

/** `Sentry.init({ beforeBreadcrumb })`: strips the query string from http and navigation crumbs. */
export function limpiarMigaDePan(miga: Breadcrumb): Breadcrumb {
  const salida: Breadcrumb = { ...miga }
  if (typeof salida.message === 'string') salida.message = sinQuery(salida.message)
  if (salida.data) {
    const data: Record<string, unknown> = { ...salida.data }
    for (const clave of LIMPIAR_EN_MIGAS) if (typeof data[clave] === 'string') data[clave] = sinQuery(data[clave] as string)
    salida.data = data
  }
  return salida
}

/** `Sentry.init({ beforeSend })`: strips the query string from the request, the exception messages and the event message. */
export function limpiarEvento(evento: ErrorEvent): ErrorEvent {
  const salida: ErrorEvent = { ...evento }
  if (salida.request) {
    const { query_string: _consulta, ...resto } = salida.request
    salida.request = { ...resto, ...(typeof resto.url === 'string' ? { url: sinQuery(resto.url) } : {}) }
  }
  if (typeof salida.message === 'string') salida.message = sinQuery(salida.message)
  if (salida.exception?.values) {
    salida.exception = {
      ...salida.exception,
      values: salida.exception.values.map((v) => (typeof v.value === 'string' ? { ...v, value: sinQuery(v.value) } : v)),
    }
  }
  if (salida.breadcrumbs) salida.breadcrumbs = salida.breadcrumbs.map(limpiarMigaDePan)
  return salida
}

interface Sesion { user: { id: string } | null }
interface Tienda { getState: () => Sesion; subscribe: (oyente: (s: Sesion) => void) => () => void }

/** Attaches only the user id to Sentry events while a session is open, and clears it on logout. Returns the unsubscribe. */
export function vincularUsuarioASentry(tienda: Tienda): () => void {
  let ultimo: string | null | undefined
  const aplicar = (s: Sesion) => {
    const id = s.user?.id ?? null
    if (id === ultimo) return
    ultimo = id
    Sentry.setUser(id ? { id } : null)
  }
  aplicar(tienda.getState())
  return tienda.subscribe(aplicar)
}
