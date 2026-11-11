import { storage } from '@/core/utils/storage'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'

/**
 * Depósito de la sesión, como en la web (forward-frontend: packages/api-client/src/deposito-sesion.ts y
 * apps/web/src/shared/lib/alcance-deposito.ts). Lo elige en Inicio quien ve todos los depósitos
 * (CAP_VER_TODOS_LOS_DEPOSITOS) y cada pantalla que lee un depósito arranca en él.
 *
 * Diferencia con la web: allá dura la pestaña (sessionStorage); en el teléfono se guarda en MMKV y sobrevive a
 * cerrar la app, como el resto de las preferencias. Se guarda con el id de quien eligió: otro usuario en el mismo
 * teléfono no la hereda (`depositoDeSesionDe` le devuelve `undefined` y `descartarSiEsDeOtro` la borra).
 */
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

/** Depósito propio de quien opera: el del usuario y, si no tiene uno, el Central (deposito-por-defecto.ts de la web). */
export function depositoPropioODefecto(propioId: string | null | undefined): string {
  return propioId || DEPOSITO_CENTRAL_ID
}

/**
 * Depósito de la sesión con el que se LEE (listados, tableros). `null` es "Todos" y solo lo puede tener quien ve
 * todos los depósitos. Sin CAP_VER_TODOS_LOS_DEPOSITOS manda siempre el propio, lo que haya guardado; con la
 * capacidad y sin elección, también el propio (al entrar no se arranca en "Todos").
 */
export function depositoSesionEfectivo(
  puedeVerTodos: boolean,
  propioId: string | null | undefined,
  eleccion: string | null | undefined,
): string | null {
  if (!puedeVerTodos || eleccion === undefined) return depositoPropioODefecto(propioId)
  return eleccion
}

/** Depósito en el que se REGISTRA o se consulta disponibilidad: el de la sesión y, con "Todos", el Central. */
export function depositoParaRegistrarDe(
  puedeVerTodos: boolean,
  propioId: string | null | undefined,
  eleccion: string | null | undefined,
): string {
  return depositoSesionEfectivo(puedeVerTodos, propioId, eleccion) ?? DEPOSITO_CENTRAL_ID
}
