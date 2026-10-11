import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/** GET /Calendario: el servidor filtra lo que cada uno puede ver (personales; lo de la empresa según el puesto). */
export type EventoCalendario = components['schemas']['EventoCalendarioDto']
export type CrearEvento = components['schemas']['CrearEventoCommand']

export const calendarioKeys = {
  all: ['calendario'] as const,
  rango: (desde: string, hasta: string) => [...calendarioKeys.all, desde, hasta] as const,
}

/** Desde y hasta son días YYYY-MM-DD, inclusive (el servidor acepta hasta 93 días). */
export function useCalendario(desde: string, hasta: string) {
  return useQuery({
    queryKey: calendarioKeys.rango(desde, hasta),
    queryFn: () => api.get<EventoCalendario[]>(`/api/v1/Calendario?Desde=${desde}&Hasta=${hasta}`),
  })
}

/** POST /Calendario/eventos: devuelve el id del evento nuevo. */
export function useCrearEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (evento: CrearEvento) => api.post<string>('/api/v1/Calendario/eventos', evento),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarioKeys.all }),
  })
}
