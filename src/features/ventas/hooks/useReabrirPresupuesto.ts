import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { conClave, crearIntento } from '@/core/utils/idempotencia'
import { invalidarPorCambioDeVenta } from '@/libs/api-client/invalidaciones'

/** Una clave por intento de reabrir: el reintento repite la misma; el id de la venta va en la ruta y entra en la huella. */
const intentoReabrir = crearIntento()

/** POST Ventas/{id}/reabrir: un presupuesto Vencido vuelve a Pendiente y el servidor recalcula el plazo. */
export function useReabrirPresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => conClave(intentoReabrir, {}, (cuerpo) => api.post<unknown>(`/api/v1/Ventas/${id}/reabrir`, cuerpo), id),
    onSettled: () => invalidarPorCambioDeVenta(queryClient),
  })
}
