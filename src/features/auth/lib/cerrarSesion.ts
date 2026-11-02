import type { QueryClient } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { useAuthStore } from '../store/auth.store'
import { useOfertaDeHuella } from '../store/ofertaDeHuella.store'
import { forgetBiometricLogin } from '../utils/biometrics'

/**
 * The one logout of the app (audit A-01 + M-02). Every path ends here, in one of two kinds:
 * - manual: "Cerrar sesión" (Mi cuenta and the side menu, through `useCerrarSesion`) and changing server. It also
 *   deletes the fingerprint credential and its decision ("Se borra al cerrar sesión" is the person's own action).
 * - forced: the server rejects the refresh (`onUnauthorized`), or a path only drops the tokens. It keeps the
 *   fingerprint credential and decision, so the person re-enters with "Entrar con huella".
 * Both empty the tokens, the react-query cache (memory and disk), the active trip and any unanswered fingerprint
 * offer. A different person logging in afterwards is handled at login (`getBiometricChoiceFor`).
 *
 * What is NOT cleared on purpose: the per-user offline queues (`features/venta-sin-senal/lib/cola.ts`,
 * `features/logistica/cola/colaConsola.ts`). They hold sales and deliveries not yet sent; they are keyed by
 * user, so another user of the phone neither sees nor sends them.
 */

export interface OpcionesDeCierre {
  /** The session expired or was rejected (not the person's choice): the fingerprint stays. */
  forzado?: boolean
}

interface CacheDeLaApp {
  queryClient: QueryClient
  persister: Pick<Persister, 'removeClient'>
}

let cacheDeLaApp: CacheDeLaApp | null = null
/** True while `cerrarSesion()` drops the tokens: its own transition must not start a second cleanup. */
let cerrando = false

/**
 * Everything of the session except the tokens. `removeClient` goes AFTER `clear()`: each `removed` event that
 * `clear()` emits triggers a save, which MMKV (synchronous) writes at once; removing first would leave on disk
 * what that last event saves. Today that last save already has no queries (QueryCache removes, then notifies)
 * and no mutations (none is saved, `debePersistirMutacion`); `removeClient` still leaves the disk empty and
 * covers that changing: `MutationCache.clear()` notifies `removed` before emptying. It relies on a persister that
 * writes at once, like MMKV.
 */
async function borrarDatosDeLaSesion({ forzado }: OpcionesDeCierre): Promise<void> {
  if (cacheDeLaApp) {
    cacheDeLaApp.queryClient.clear()
    await cacheDeLaApp.persister.removeClient()
  }
  useLogisticaStore.getState().reset()
  await useLogisticaStore.persist.clearStorage()
  useOfertaDeHuella.getState().descartar()
  if (!forzado) await forgetBiometricLogin()
}

/**
 * Closes the session on this phone: drops the tokens and empties the react-query cache (memory and disk), the
 * active trip (`forward-logistica-store`); a manual logout also deletes the fingerprint credential and its decision.
 * Callable outside React. Revoking on
 * the server and navigating are the caller's job (`useCerrarSesion`).
 */
export async function cerrarSesion(opciones: OpcionesDeCierre = {}): Promise<void> {
  cerrando = true
  try {
    useAuthStore.getState().logout()
  } finally {
    cerrando = false
  }
  await borrarDatosDeLaSesion(opciones)
}

/**
 * Connects the app's query client and persister (`app/_layout.tsx`). It also listens to the auth store: a path
 * that only drops the tokens (`useAuthStore.getState().logout()`) still empties the rest, as a forced logout. It is a
 * safety net: the known forced paths (`onUnauthorized`, `hooks/useAuthGuard.ts`) call `cerrarSesion({ forzado: true })`. Rehydrating the session on app start or authenticating again clears nothing. Returns how to disconnect.
 */
export function conectarCierreDeSesion(queryClient: QueryClient, persister: Pick<Persister, 'removeClient'>): () => void {
  cacheDeLaApp = { queryClient, persister }
  const dejarDeEscuchar = useAuthStore.subscribe((estado, antes) => {
    if (cerrando || !antes.isAuthenticated || estado.isAuthenticated) return
    void borrarDatosDeLaSesion({ forzado: true })
  })
  return () => {
    dejarDeEscuchar()
    cacheDeLaApp = null
  }
}
