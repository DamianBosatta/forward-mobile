import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'

/** GET /Notificaciones: el destinatario sale del token; el servidor filtra lo financiero y lo vencido. */
export type BandejaAvisos = components['schemas']['NotificacionesBandejaDto']
export type Aviso = components['schemas']['NotificacionDto']
export type PreferenciaAviso = components['schemas']['PreferenciaNotificacionDto']
export type PreferenciaToast = components['schemas']['PreferenciaToastDto']

/** Página de la bandeja (el servidor acota a 1..100). */
export const AVISOS_POR_PAGINA = 30

/** Keyset del servidor: avisos anteriores al último de la página previa (fecha + id para desempatar). */
export interface CursorAvisos {
  antesDe: string
  antesDeId: string
}

export const notificacionesKeys = {
  all: ['notificaciones'] as const,
  bandeja: (soloNoLeidas: boolean) => [...notificacionesKeys.all, 'bandeja', soloNoLeidas] as const,
  noLeidas: () => [...notificacionesKeys.all, 'noLeidas'] as const,
  preferencias: () => [...notificacionesKeys.all, 'preferencias'] as const,
}

export function urlBandeja(soloNoLeidas: boolean, limite: number, cursor?: CursorAvisos): string {
  const p = new URLSearchParams({ SoloNoLeidas: String(soloNoLeidas), Limite: String(limite) })
  if (cursor) {
    p.set('AntesDe', cursor.antesDe)
    p.set('AntesDeId', cursor.antesDeId)
  }
  return `/api/v1/Notificaciones?${p}`
}

/** El cursor de la página que sigue, o `undefined` si el servidor dice que no hay más. */
export function cursorSiguiente(pagina: BandejaAvisos): CursorAvisos | undefined {
  const ultimo = pagina.items[pagina.items.length - 1]
  if (!pagina.hayMas || !ultimo) return undefined
  return { antesDe: ultimo.fechaCreacion, antesDeId: ultimo.id }
}

// Los avisos cambian a cada rato y son de un usuario: no se guardan en el teléfono.
const NO_PERSISTIR = { persist: false }

export function useBandejaAvisos(soloNoLeidas: boolean) {
  return useInfiniteQuery({
    queryKey: notificacionesKeys.bandeja(soloNoLeidas),
    queryFn: ({ pageParam }) => api.get<BandejaAvisos>(urlBandeja(soloNoLeidas, AVISOS_POR_PAGINA, pageParam)),
    initialPageParam: undefined as CursorAvisos | undefined,
    getNextPageParam: cursorSiguiente,
    meta: NO_PERSISTIR,
  })
}

/** El número del badge: `noLeidas` no depende del límite, así que alcanza con pedir una fila. */
export function useAvisosNoLeidosQuery(enabled: boolean, refetchInterval: number) {
  return useQuery({
    queryKey: notificacionesKeys.noLeidas(),
    queryFn: async () => (await api.get<BandejaAvisos>(urlBandeja(true, 1))).noLeidas,
    enabled,
    refetchInterval,
    meta: NO_PERSISTIR,
  })
}

/** POST /Notificaciones/marcar-leidas: con ids marca esos; sin ids, todas las que la bandeja muestra. */
export function useMarcarAvisosLeidos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids?: string[]) => api.post<number>('/api/v1/Notificaciones/marcar-leidas', ids?.length ? { ids } : {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificacionesKeys.all }),
    meta: { noRefrescaInicio: true },
  })
}

export function usePreferenciasAvisos() {
  return useQuery({
    queryKey: notificacionesKeys.preferencias(),
    queryFn: () => api.get<PreferenciaAviso[]>('/api/v1/Notificaciones/preferencias'),
  })
}

/** PUT /Notificaciones/preferencias: el servidor rechaza silenciar un aviso crítico. */
export function useActualizarPreferenciasAvisos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (preferencias: PreferenciaToast[]) => api.put<number>('/api/v1/Notificaciones/preferencias', { preferencias }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificacionesKeys.preferencias() }),
    meta: { noRefrescaInicio: true },
  })
}

// ── Push (9B, T9) ─────────────────────────────────────────────────────────────────────────────

export type RegistrarDispositivoPush = components['schemas']['RegistrarDispositivoPushCommand']

const DISPOSITIVOS_PUSH = '/api/v1/Notificaciones/dispositivos'

/**
 * Lo que un servidor anterior al push responde: 404/405 sin el endpoint, 400 si no reconoce el
 * cuerpo. Es lo esperado mientras ese servidor siga en pie, no una falla (no va a Sentry).
 */
export const ESTADOS_ESPERADOS_PUSH = [400, 404, 405]

/** POST /Notificaciones/dispositivos: idempotente; si el token era de otro usuario, pasa a este. */
export function registrarDispositivoPush(cuerpo: RegistrarDispositivoPush): Promise<void> {
  return api.post<void>(DISPOSITIVOS_PUSH, cuerpo, { estadosEsperados: ESTADOS_ESPERADOS_PUSH } as RequestInit)
}

/**
 * DELETE /Notificaciones/dispositivos: borra solo un token propio (uno ajeno o desconocido es 204).
 * `accessToken` permite mandarlo con la sesión que se está cerrando, cuando el store ya la borró.
 */
export function eliminarDispositivoPush(token: string, accessToken?: string | null): Promise<void> {
  return api.delete<void>(DISPOSITIVOS_PUSH, { token }, {
    estadosEsperados: ESTADOS_ESPERADOS_PUSH,
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  } as RequestInit)
}
