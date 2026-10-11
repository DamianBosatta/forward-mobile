import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth.store'

/**
 * Al cerrarse la sesión por cualquier camino (Salir, o el cierre forzado cuando el servidor rechaza
 * el refresh y `onUnauthorized` llama a `logout`) se vacía la caché de consultas, y con ella la que
 * se guarda en el teléfono: el próximo usuario no ve los datos del anterior. Rehidratar la sesión al
 * abrir la app no la toca. Devuelve la función para dejar de escuchar.
 */
export function vaciarCacheAlCerrarSesion(queryClient: QueryClient): () => void {
  return useAuthStore.subscribe((estado, antes) => {
    if (antes.isAuthenticated && !estado.isAuthenticated) queryClient.clear()
  })
}
