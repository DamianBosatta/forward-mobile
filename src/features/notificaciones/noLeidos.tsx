import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { notificacionesKeys, useAvisosNoLeidosQuery } from '@/libs/api-client/notificaciones'

/** Cada cuánto se vuelve a mirar el badge con la app abierta (no hay push: ver BACKLOG-9B). */
export const INTERVALO_BADGE_MS = 60_000

/** Cantidad de avisos sin leer del usuario; cero sin sesión o mientras no llega. */
export function useAvisosNoLeidos(): number {
  const autenticado = useAuthStore((s) => s.isAuthenticated)
  return useAvisosNoLeidosQuery(autenticado, INTERVALO_BADGE_MS).data ?? 0
}

/**
 * Montado una vez en la raíz: al volver la app al frente, la bandeja y el badge se vuelven a
 * pedir. Es lo más cerca de un push que se puede llegar sin registro de dispositivos.
 */
export function AvisosAlVolver() {
  const qc = useQueryClient()
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void qc.invalidateQueries({ queryKey: notificacionesKeys.all })
    })
    return () => sub.remove()
  }, [qc])
  return null
}
