import { useSyncExternalStore } from 'react'
import { onlineManager, type FetchStatus } from '@tanstack/react-query'

/** La misma señal que usa el aviso de sin conexión de la app (onlineManager de React Query). */
export function useEnLinea(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  )
}

/**
 * Sin red, React Query deja la consulta en pausa: no hay datos, ni carga, ni error. Sin nada guardado eso
 * es "sin conexión", no "vacío". Con datos guardados, la lista los muestra (y el aviso de arriba avisa).
 */
export function useSinConexionSinDatos(q: { data?: unknown; fetchStatus: FetchStatus }): boolean {
  const enLinea = useEnLinea()
  return q.data === undefined && (!enLinea || q.fetchStatus === 'paused')
}
