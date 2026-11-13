import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { invalidarPorCambioDeVenta } from '@/libs/api-client/invalidaciones'

/** POST Ventas/{id}/reabrir: un presupuesto Vencido vuelve a Pendiente y el servidor recalcula el plazo. */
export function useReabrirPresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/api/v1/Ventas/${id}/reabrir`),
    onSettled: () => invalidarPorCambioDeVenta(queryClient),
  })
}
