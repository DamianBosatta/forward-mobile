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
  revokeSession: (tokenId: string) => api.delete(`/api/v1/sessions/${tokenId}`),
  getAccessLogs: async (limit: number = 20) => {
    try {
      return await api.get<AccessLog[]>(`/api/v1/audit/logs?limit=${limit}`)
    } catch (error: any) {
      if (error?.status === 404) return []
      throw error
    }
  },
};
