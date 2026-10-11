import type { QueryClient } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { useAuthStore } from '../store/auth.store'

/**
 * Al cerrarse la sesión por cualquier camino (Salir, o el cierre forzado cuando el servidor rechaza
 * el refresh y `onUnauthorized` llama a `logout`) se vacía la caché de consultas y la copia guardada
 * en el teléfono, sin esperar al guardado periódico (la app puede morir enseguida): el próximo
 * usuario no ve los datos del anterior. Rehidratar la sesión al abrir la app no la toca. Devuelve la
 * función para dejar de escuchar.
 */
export function vaciarCacheAlCerrarSesion(queryClient: QueryClient, persister: Pick<Persister, 'removeClient'>): () => void {
  return useAuthStore.subscribe((estado, antes) => {
    if (!antes.isAuthenticated || estado.isAuthenticated) return
    queryClient.clear()
    void persister.removeClient()
  })
}
