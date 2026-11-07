import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { calendarioKeys } from '@/libs/api-client/calendario'
import type { EstadoTarea } from './tarea'

/**
 * Cambia el estado de una tarea (`POST /calendario/eventos/{id}/estado`). Lo usan quien la creó, un asignado o quien tiene
 * CAP_ASIGNAR_TAREAS: lo decide el servidor (403 `TareaSinPermiso`). El estado también pinta el evento, así que se
 * vuelve a pedir todo el calendario. Va acá y no en `libs/api-client` porque el cliente generado todavía no la trae.
 */
export function useCambiarEstadoTarea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoTarea }) => api.post<string>(`/api/v1/Calendario/eventos/${id}/estado`, { estado }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: calendarioKeys.all }) },
  })
}
