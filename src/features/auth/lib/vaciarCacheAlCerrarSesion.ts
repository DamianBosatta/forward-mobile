import type { QueryClient } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { useAuthStore } from '../store/auth.store'
import { useLogisticaStore } from '@/features/logistica/store/logistica.store'

/**
 * Al cerrarse la sesión por cualquier camino (Salir, o el cierre forzado cuando el servidor rechaza
 * el refresh y `onUnauthorized` llama a `logout`) se vacía la caché de consultas y la copia guardada
 * en el teléfono: el próximo usuario no ve los datos del anterior. Rehidratar la sesión al abrir la
 * app no la toca. Devuelve la función para dejar de escuchar.
 *
 * `removeClient` va DESPUÉS de `clear()`: cada `removed` que avisa el `clear()` dispara un guardado,
 * que con MMKV (síncrono) escribe en el momento; borrar antes dejaría en el disco lo que guarde ese
 * último aviso. Hoy ese último guardado ya sale sin consultas (QueryCache borra y después avisa) y sin
 * mutaciones (no se guarda ninguna, `debePersistirMutacion`); `removeClient` igual deja el disco sin
 * nada y cubre que eso cambie: `MutationCache.clear()` avisa `removed` antes de vaciarse, así que si
 * se volvieran a guardar mutaciones, el último guardado todavía las tendría. Depende de que el
 * persister escriba en el momento, como MMKV: con uno asíncrono o con demora, el borrado y los
 * guardados podrían terminar en otro orden.
 */
export function vaciarCacheAlCerrarSesion(queryClient: QueryClient, persister: Pick<Persister, 'removeClient'>): () => void {
  return useAuthStore.subscribe((estado, antes) => {
    if (!antes.isAuthenticated || estado.isAuthenticated) return
    queryClient.clear()
    void persister.removeClient()
    // El viaje activo del chofer se guarda aparte (AsyncStorage): tampoco pasa al próximo usuario (A-905).
    useLogisticaStore.getState().reset()
  })
}
