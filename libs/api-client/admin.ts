import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'
import type {
  PagedResult,
  UserListDto,
  UserDetailDto,
  ModulePermissionDto,
} from './types'

// Backward-compatible aliases
type UserListItem = UserListDto
type UserDetail   = UserDetailDto
type ModulePermission = ModulePermissionDto

// ── Query Keys ────────────────────────────────────────────────────────────────

export const adminKeys = {
  allUsers: ['usuarios'] as const,
  users:    (params: object) => [...adminKeys.allUsers, params] as const,
  user:     (id: string)     => ['usuario', id] as const,
  userSessions: (id: string) => [...adminKeys.user(id), 'sessions'] as const,
  userLogs:     (id: string) => [...adminKeys.user(id), 'logs'] as const,
}

// ── Params para lista de usuarios ─────────────────────────────────────────────

export interface GetUsuariosParams {
  searchTerm?: string
  role?:       string
  isActive?:   boolean
  pageNumber?: number
  pageSize?:   number
}

/** /sessions: SesionActivaDto del contrato (id, createdAt, expiresAt, device, ip, esActual). */
export type UserSessionDto = components['schemas']['SesionActivaDto']

/**
 * AuditLogDto — matches the backend UserAuditLogDto response.
 * A mano a propósito (C-021): GET /Users/{id}/audit-logs no publica esquema de respuesta en openapi.json
 * (`content?: never`), así que no hay de dónde derivarlo hasta que el backend lo declare.
 * Returned by GET /api/v1/Users/{id}/audit-logs.
 */
export interface AuditLogDto {
  id: string
  fechaAcceso?: string
  ipAddress?: string
  userAgent?: string
  exitoso?: boolean
  ubicacionEstimada?: string
  deviceInfo?: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useUsuarios(params: GetUsuariosParams = {}) {
  const q = new URLSearchParams()
  if (params.pageNumber !== undefined) q.set('pageNumber', String(params.pageNumber))
  if (params.pageSize   !== undefined) q.set('pageSize',   String(params.pageSize))
  if (params.searchTerm)               q.set('searchTerm', params.searchTerm)
  if (params.role)                     q.set('role',       params.role)
  if (params.isActive   !== undefined) q.set('isActive',   String(params.isActive))

  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn:  () => api.get<PagedResult<UserListDto>>(`/api/v1/Users?${q}`),
  })
}

export function useUsuario(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn:  () => api.get<UserDetailDto>(`/api/v1/Users/${id}`),
    enabled:  !!id,
  })
}

export function useUserSessions(userId: string) {
  return useQuery({
    queryKey: adminKeys.userSessions(userId),
    queryFn: async () => {
      try {
        return await api.get<UserSessionDto[]>(`/api/v1/Users/${userId}/sessions`)
      } catch (error: any) {
        if (error?.status === 404) return []
        throw error
      }
    },
    enabled: !!userId,
  })
}

export function useUserLogs(userId: string) {
  return useQuery({
    queryKey: adminKeys.userLogs(userId),
    queryFn: async () => {
      try {
        return await api.get<AuditLogDto[]>(`/api/v1/Users/${userId}/audit-logs?limit=5`)
      } catch (error: any) {
        if (error?.status === 404) return []
        throw error
      }
    },
    enabled: !!userId,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdatePermisos(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (permissions: ModulePermissionDto[]) =>
      api.put<void>(`/api/v1/Users/${userId}/permissions`, permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.user(userId) })
    },
  })
}

export function useToggleActivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api.patch<boolean>(`/api/v1/Users/${userId}/toggle-active`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.allUsers })
    },
  })
}