import type { QueryClient } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'
import { useAuthStore } from '../store/auth.store'
import { useOfertaDeHuella } from '../store/ofertaDeHuella.store'
import { forgetBiometricLogin } from '../utils/biometrics'

/**
 * The one logout of the app (audit A-01 + M-02). Every path ends here: "Cerrar sesión" (Mi cuenta and the
 * side menu, through `useCerrarSesion`), changing server, and the forced logout when the server rejects the
 * refresh (`onUnauthorized`). Nothing of the previous session stays on the phone for the next user.
 *
 * What is NOT cleared on purpose: the per-user offline queues (`features/venta-sin-senal/lib/cola.ts`,
 * `features/logistica/cola/colaConsola.ts`). They hold sales and deliveries not yet sent; they are keyed by
 * user, so another user of the phone neither sees nor sends them.
 */

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
async function borrarDatosDeLaSesion(): Promise<void> {
  if (cacheDeLaApp) {
    cacheDeLaApp.queryClient.clear()
    await cacheDeLaApp.persister.removeClient()
  }
  useLogisticaStore.getState().reset()
  await useLogisticaStore.persist.clearStorage()
  useOfertaDeHuella.getState().descartar()
  await forgetBiometricLogin()
}

/**
 * Closes the session on this phone: drops the tokens and empties the react-query cache (memory and disk), the
 * active trip (`forward-logistica-store`) and the fingerprint credential with its decision (S2: "Se borra al
 * cerrar sesión"). Callable outside React. Revoking on
 * the server and navigating are the caller's job (`useCerrarSesion`).
 */
export async function cerrarSesion(): Promise<void> {
  cerrando = true
  try {
    useAuthStore.getState().logout()
  } finally {
    cerrando = false
  }
  await borrarDatosDeLaSesion()
}

/**
 * Connects the app's query client and persister (`app/_layout.tsx`). It also listens to the auth store: a path
 * that only drops the tokens (`useAuthStore.getState().logout()`, e.g. `hooks/useAuthGuard.ts`) still empties the
 * rest. Rehydrating the session on app start or authenticating again clears nothing. Returns how to disconnect.
 */
export function conectarCierreDeSesion(queryClient: QueryClient, persister: Pick<Persister, 'removeClient'>): () => void {
  cacheDeLaApp = { queryClient, persister }
  const dejarDeEscuchar = useAuthStore.subscribe((estado, antes) => {
    if (cerrando || !antes.isAuthenticated || estado.isAuthenticated) return
    void borrarDatosDeLaSesion()
  })
  return () => {
    dejarDeEscuchar()
    cacheDeLaApp = null
  }
}
