import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/libs/api-client/client'

export interface CambioContrasena {
  /** El servidor exige que sea el correo del token (si no, 403). */
  email: string
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

/**
 * POST /api/v1/Users/change-password. Las reglas (10 caracteres con mayúscula, minúscula,
 * número y símbolo) las aplica Identity en el servidor y sus errores llegan en `message`.
 */
export function useCambiarContrasena() {
  return useMutation({
    mutationFn: (body: CambioContrasena) => api.post<boolean>('/api/v1/Users/change-password', body),
  })
}

/**
 * POST /api/v1/Sessions/logout: revoca en el servidor TODAS las sesiones del usuario (no hay
 * forma de identificar solo la de este teléfono). Devuelve si se pudo: la salida local no depende
 * del servidor, pero quien llama tiene que avisar si falló.
 */
export async function cerrarSesionEnElServidor(): Promise<boolean> {
  try {
    await api.post('/api/v1/Sessions/logout', {})
    return true
  } catch {
    return false
  }
}

export const AVISO_SESION_NO_CERRADA_EN_TODOS =
  'Se cerró en este teléfono; no se pudo cerrar en los demás dispositivos. Probá de nuevo desde la web o más tarde.'

/** Una sesión abierta (refresh token vigente) del usuario. `device` es el User-Agent tal cual. */
export interface SesionAbierta {
  id: string
  createdAt: string | null
  expiresAt: string | null
  device: string
  ip: string
}

const sesionesKey = ['cuenta', 'sesiones'] as const

/** GET /api/v1/Sessions: las sesiones vigentes del usuario. */
export function useSesiones() {
  return useQuery({ queryKey: sesionesKey, queryFn: () => api.get<SesionAbierta[]>('/api/v1/Sessions'), staleTime: 60_000 })
}

/** DELETE /api/v1/Sessions/{id}: cierra esa sesión. */
export function useCerrarSesionAbierta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/Sessions/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sesionesKey }),
  })
}
