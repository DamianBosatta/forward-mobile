import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidarPorAvisos, invalidarTodo } from '@/libs/api-client/invalidaciones'
import { gestorStock, type GestorStock } from './stockEnVivo'

/**
 * Avisos en vivo de cambios de datos: mientras `activo` (hay sesión) se escucha `EntidadCambio` en la
 * conexión de `/hubs/stock` y cada aviso refresca lo afectado por la regla central. Al reconectar o
 * volver de segundo plano pudo perderse algún aviso: se marca vieja toda la caché una vez y se vuelven
 * a pedir las consultas activas.
 */
export function useAvisosEnVivo(activo: boolean, gestor: Pick<GestorStock, 'suscribirAvisos'> = gestorStock): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!activo) return
    return gestor.suscribirAvisos({
      alAvisos: (avisos) => { void invalidarPorAvisos(queryClient, avisos) },
      alReconectar: () => { void invalidarTodo(queryClient) },
    })
  }, [activo, gestor, queryClient])
}
