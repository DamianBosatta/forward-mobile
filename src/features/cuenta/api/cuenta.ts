import { useMutation } from '@tanstack/react-query'
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
 * forma de identificar solo la de este teléfono). Si falla (sin señal), igual se sale localmente.
 */
export async function cerrarSesionEnElServidor(): Promise<void> {
  try {
    await api.post('/api/v1/Sessions/logout', {})
  } catch {
    // La salida local no depende del servidor.
  }
}
