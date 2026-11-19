import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './generated/schema'
import type {
  PagedResult,
  UserListDto,
  UserDetailDto,
  ModulePermissionDto,
} from './types'
import { invalidarUsuarios } from './invalidaciones'

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
