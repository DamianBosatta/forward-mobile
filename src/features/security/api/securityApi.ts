import { api } from '@/src/core/api/client';

export interface UserSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  device: string;
  ip: string;
  isCurrent?: boolean;
}

export interface AccessLog {
  id: string;
  fechaAcceso: string;
  ipAddress: string;
  userAgent: string;
  exitoso: boolean;
  ubicacionEstimada?: string;
  deviceInfo?: string;
}

export interface PermissionProfileDetail {
  id: string;
  module: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface PermissionProfile {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  roleName?: string;
  detalles: PermissionProfileDetail[];
}

export interface SavePermissionProfileDetailPayload {
  module: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface SavePermissionProfilePayload {
  nombre: string;
  descripcion?: string;
  activo: boolean;
  detalles: SavePermissionProfileDetailPayload[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  userCount: number;
  profileId?: string;
  profileName?: string;
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
}

export interface UpdateRolePayload {
  description?: string;
}

export function buildPermissionProfilePayload(profile: Partial<PermissionProfile>): SavePermissionProfilePayload {
  return {
    nombre: profile.nombre?.trim() ?? '',
    descripcion: profile.descripcion?.trim() || undefined,
    activo: profile.activo ?? true,
    detalles: (profile.detalles ?? []).map((detail) => ({
      module: detail.module,
      canRead: detail.canRead,
      canCreate: detail.canCreate,
      canUpdate: detail.canUpdate,
      canDelete: detail.canDelete,
    })),
  }
}

export const securityApi = {
  // Sessions
  getSessions: async () => {
    try {
      return await api.get<UserSession[]>('/api/v1/sessions')
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  getUserSessions: async (userId: string) => {
    try {
      return await api.get<UserSession[]>(`/api/v1/Users/${userId}/sessions`)
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  revokeSession: (tokenId: string) => api.delete(`/api/v1/sessions/${tokenId}`),
  getAccessLogs: async (limit: number = 20) => {
    try {
      return await api.get<AccessLog[]>(`/api/v1/audit/logs?limit=${limit}`)
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  getUserAccessLogs: async (userId: string, limit: number = 20) => {
    try {
      return await api.get<AccessLog[]>(`/api/v1/Users/${userId}/audit-logs?limit=${limit}`)
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  
  // Permission Profiles
  getProfiles: async () => {
    try {
      return await api.get<PermissionProfile[]>('/api/v1/PermissionProfiles')
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  getProfile: async (id: string) => {
    try {
      return await api.get<PermissionProfile>(`/api/v1/PermissionProfiles/${id}`)
    } catch (error: any) {
      if (error?.status === 404) return null
      throw error
    }
  },
  createProfile: (profile: Partial<PermissionProfile>) =>
    api.post<PermissionProfile>('/api/v1/PermissionProfiles', buildPermissionProfilePayload(profile)),
  updateProfile: (id: string, profile: Partial<PermissionProfile>) =>
    api.put(`/api/v1/PermissionProfiles/${id}`, buildPermissionProfilePayload(profile)),
  deleteProfile: (id: string) => api.delete(`/api/v1/PermissionProfiles/${id}`),
  applyProfileToUser: (profileId: string, userId: string) => api.post(`/api/v1/PermissionProfiles/${profileId}/apply-to-user/${userId}`, {}),

  // Roles
  getRoles: async () => {
    try {
      return await api.get<Role[]>('/api/v1/Roles')
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
  getRole: async (id: string) => {
    try {
      return await api.get<Role>(`/api/v1/Roles/${id}`)
    } catch (error: any) {
      if (error?.status === 404) return null
      throw error
    }
  },
  assignRoleToUser: (userId: string, roleName: string) => api.post(`/api/v1/Roles/${roleName}/assign/${userId}`, {}),
  updateRoleProfile: (roleId: string, profileId: string) => api.put(`/api/v1/Roles/${roleId}/profile`, { profileId }),
  createRole: (payload: CreateRolePayload) => api.post<Role>('/api/v1/Roles', payload),
  updateRole: (id: string, payload: UpdateRolePayload) => api.put(`/api/v1/Roles/${id}`, payload),
  deleteRole: (id: string) => api.delete(`/api/v1/Roles/${id}`),

  // Users
  createUser: (payload: CreateUserPayload) => api.post('/api/v1/Users', payload),
  updateUser: (id: string, payload: UpdateUserPayload) => api.put(`/api/v1/Users/${id}`, payload),
  deactivateUser: (id: string) => api.patch(`/api/v1/Users/${id}/deactivate`, {}),
};
