import { storage } from '@/core/utils/storage'
import { useAuthStore } from '@/features/auth/store/auth.store'

/**
 * Depósito de la sesión (S8), como el cliente compartido de la web (forward-frontend:
 * packages/api-client/src/deposito-sesion.ts). Lo elige en Inicio quien ve todos los depósitos y viaja en cada pedido
 * como el encabezado `X-Deposito-Sesion`; el servidor lo lee en un solo lugar (`RecordAccessPolicy.FiltroAsync`) y SOLO
 * achica los listados de quien ya ve todos. A quien tiene un depósito propio se lo ignora: nunca amplía lo que ve.
 *
 * Diferencia con la web: allá dura la pestaña (sessionStorage); en el teléfono se guarda en MMKV y sobrevive a cerrar
 * la app. Se guarda con el id de quien eligió: el encabezado viaja solo si lo eligió el usuario con sesión ahora (el
 * del store de auth), así otro usuario en el mismo teléfono, o nadie antes del login, no lo manda.
 */
export const ENCABEZADO_DEPOSITO_SESION = 'X-Deposito-Sesion'

const CLAVE = 'forward-deposito-sesion'
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Eleccion {
  usuarioId: string
  /** `null` es "Todos los depósitos" elegido a propósito: NO es lo mismo que no haber elegido. */
  depositoId: string | null
}

const oyentes = new Set<() => void>()

function leer(): Eleccion | null {
  try {
    const crudo = storage.getString(CLAVE)
    if (!crudo) return null
    const valor = JSON.parse(crudo) as Partial<Eleccion>
    if (typeof valor.usuarioId !== 'string') return null
    if (valor.depositoId === null) return { usuarioId: valor.usuarioId, depositoId: null }
    return typeof valor.depositoId === 'string' && GUID_RE.test(valor.depositoId)
      ? { usuarioId: valor.usuarioId, depositoId: valor.depositoId }
      : null
  } catch {
    return null
  }
}

function escribir(eleccion: Eleccion | null) {
  try {
    if (eleccion) storage.set(CLAVE, JSON.stringify(eleccion))
    else storage.remove(CLAVE)
  } catch {
    // Sin almacenamiento no hay elección que recordar: cada pantalla sigue en el depósito propio.
  }
  oyentes.forEach((oyente) => oyente())
}

/**
 * La elección de ESTE usuario: un id, `null` si eligió "Todos" a propósito, o `undefined` si todavía no eligió
 * (arranca en su depósito propio).
 */
export function depositoDeSesionDe(usuarioId: string | null | undefined): string | null | undefined {
  const eleccion = leer()
  return eleccion && usuarioId && eleccion.usuarioId === usuarioId ? eleccion.depositoId : undefined
}

/** Elige el depósito de la sesión; `null` es "Todos los depósitos" y se recuerda como elección explícita. */
export function elegirDepositoDeSesion(usuarioId: string, depositoId: string | null) {
  if (!usuarioId) return escribir(null)
  if (depositoId === null) return escribir({ usuarioId, depositoId: null })
  escribir(GUID_RE.test(depositoId) ? { usuarioId, depositoId } : null)
}

/** Borra la elección (sin la capacidad no se guarda nada). */
export function limpiarDepositoDeSesion() {
  escribir(null)
}

/** Borra la elección si la hizo otro usuario o si ya no hay sesión. Devuelve si borró algo. */
export function descartarSiEsDeOtro(usuarioId: string | null | undefined): boolean {
  const actual = leer()
  if (!actual || actual.usuarioId === usuarioId) return false
  escribir(null)
  return true
}

/** Avisa cada cambio del depósito elegido (para `useSyncExternalStore`). */
export function suscribirDepositoDeSesion(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** El depósito que viaja en el encabezado: solo si lo eligió el usuario con sesión ahora; "Todos" no viaja. */
function depositoParaEnviar(): string | null {
  const eleccion = leer()
  const usuarioActual = useAuthStore.getState().user?.id ?? null
  return eleccion && usuarioActual !== null && eleccion.usuarioId === usuarioActual ? eleccion.depositoId : null
}

/**
 * Deja el encabezado de un pedido saliente, ya con los encabezados manuales puestos: el depósito elegido si lo hay.
 * Un pedido con SIN_DEPOSITO_DE_SESION lo manda vacío solo cuando habría un depósito que pisar; si no hay ninguno
 * ("Todos", sin elección, sin la capacidad, sin sesión) no viaja nada, como antes: para el servidor es lo mismo
 * (vacío = sin depósito de sesión) y quien no ve todos los depósitos hace exactamente los pedidos de siempre.
 */
export function ponerEncabezadoDepositoDeSesion(headers: Headers) {
  const deposito = depositoParaEnviar()
  if (headers.get(ENCABEZADO_DEPOSITO_SESION) === '') {
    if (!deposito) headers.delete(ENCABEZADO_DEPOSITO_SESION)
    return
  }
  if (deposito) headers.set(ENCABEZADO_DEPOSITO_SESION, deposito)
}

/**
 * Opciones de pedido para las búsquedas que NO se achican con el depósito de sesión (en la web, la nueva venta busca
 * clientes y productos en todos los depósitos que el usuario puede ver). El encabezado viaja vacío: el servidor lo lee
 * como "sin depósito de sesión" y aplica solo el alcance del usuario.
 */
export const SIN_DEPOSITO_DE_SESION: RequestInit = {
  headers: { [ENCABEZADO_DEPOSITO_SESION]: '' },
}
