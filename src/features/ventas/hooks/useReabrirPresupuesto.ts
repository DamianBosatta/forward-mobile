import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { ventasKeys } from '@/libs/api-client/ventas'

/** POST Ventas/{id}/reabrir: un presupuesto Vencido vuelve a Pendiente y corren de nuevo los 45 días. */
export function useReabrirPresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/api/v1/Ventas/${id}/reabrir`),
    onSettled: (_d, _e, id) => {
      queryClient.invalidateQueries({ queryKey: ventasKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ventasKeys.all })
    },
  })
}
