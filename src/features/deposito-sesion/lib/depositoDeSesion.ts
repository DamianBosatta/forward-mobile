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
export {
  depositoDeSesionDe,
  descartarSiEsDeOtro,
  elegirDepositoDeSesion,
  limpiarDepositoDeSesion,
  suscribirDepositoDeSesion,
} from '@/core/api/depositoSesion'

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
