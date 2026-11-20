import { useMutation, useQuery, useQueryClient, type NetworkMode } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { conClave, crearIntento } from '@/core/utils/idempotencia'
import type { components } from './generated/schema'
import { invalidarCalendario } from './invalidaciones'

/** GET /Calendario: el servidor filtra lo que cada uno puede ver (personales; lo de la empresa según el puesto). */
export type EventoCalendario = components['schemas']['EventoCalendarioDto']
export type CrearEvento = components['schemas']['CrearEventoCommand']

export const calendarioKeys = {
  all: ['calendario'] as const,
  rango: (desde: string, hasta: string) => [...calendarioKeys.all, desde, hasta] as const,
  evento: (id: string) => [...calendarioKeys.all, 'evento', id] as const,
}

/** Desde y hasta son días YYYY-MM-DD, inclusive (el servidor acepta hasta 93 días). */
export function useCalendario(desde: string, hasta: string) {
  return useQuery({
    queryKey: calendarioKeys.rango(desde, hasta),
    queryFn: () => api.get<EventoCalendario[]>(`/api/v1/Calendario?Desde=${desde}&Hasta=${hasta}`),
  })
}

/** Una clave por intento (ver `crearIntento`): el reintento o el doble toque del mismo evento manda la misma. */
const intentoCrearEvento = crearIntento()

/**
 * POST /Calendario/eventos: devuelve el id del evento nuevo. `networkMode: 'always'` es para quien tiene que fallar en
 * el acto sin red (no quedar en pausa hasta que vuelva); sin él, la mutación espera la red como las demás.
 */
export function useCrearEvento({ networkMode }: { networkMode?: NetworkMode } = {}) {
  const qc = useQueryClient()
  return useMutation({
    networkMode,
    mutationFn: (evento: CrearEvento) =>
      conClave(intentoCrearEvento, evento, (cuerpo) => api.post<string>('/api/v1/Calendario/eventos', cuerpo)),
    onSuccess: () => invalidarCalendario(qc),
  })
}

export type EventoDetalle = components['schemas']['EventoCalendarioDetalleDto']
export type EditarEvento = components['schemas']['EditarEventoCommand']

/** GET /Calendario/eventos/{id}: el evento manual completo (el PUT lo reemplaza entero). Ajeno: 404. */
export function useEventoCalendario(id: string | null) {
  return useQuery({
    queryKey: calendarioKeys.evento(id ?? ''),
    queryFn: () => api.get<EventoDetalle>(`/api/v1/Calendario/eventos/${id}`),
    enabled: !!id,
  })
}

/**
 * Editar, borrar y marcar/desmarcar una ocurrencia: todo invalida el calendario. Sin devolver la
 * promesa (como `queryClient.ts`): la mutación no espera los refetch. `borrado` da el id de un
 * evento que ya no existe: sale en el acto de las semanas cargadas (no se puede volver a abrir
 * mientras llega el refetch) y su detalle, que daría 404, no se vuelve a pedir.
 */
function useMutacionCalendario<V>(fn: (v: V) => Promise<unknown>, borrado?: (v: V) => string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, v) => {
      const id = borrado?.(v)
      const semanas = { queryKey: calendarioKeys.all, predicate: (q: { queryKey: readonly unknown[] }) => !id || q.queryKey[1] !== 'evento' }
      if (id) qc.setQueriesData<EventoCalendario[]>(semanas, (semana) => semana?.filter((e) => e.origenId !== id))
      void invalidarCalendario(qc, !!id)
    },
  })
}

export const useEditarEvento = () =>
  useMutacionCalendario(({ id, ...evento }: EditarEvento & { id: string }) => api.put<string>(`/api/v1/Calendario/eventos/${id}`, evento))

export const useBorrarEvento = () =>
  useMutacionCalendario((id: string) => api.delete<string>(`/api/v1/Calendario/eventos/${id}`), (id) => id)

/** La ocurrencia se identifica por su fecha ORIGINAL (la de la clave), aunque se haya reprogramado. */
export const useMarcarPagado = () =>
  useMutacionCalendario(({ id, fecha, pagado }: { id: string; fecha: string; pagado: boolean }) => {
    const url = `/api/v1/Calendario/eventos/${id}/ocurrencias/${fecha}`
    return pagado ? api.post<string>(url, { estado: 'Pagado' }) : api.delete<string>(url)
  })
