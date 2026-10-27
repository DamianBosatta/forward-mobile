import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/libs/store/auth.store'
import { safeHaptics } from '@/core/utils/haptics'
import { darDeBajaPushAntesDeSalir } from '@/features/notificaciones'
import { AVISO_SESION_NO_CERRADA_EN_TODOS, cerrarSesionEnElServidor } from '../api/cuenta'

/**
 * Cerrar sesión, una sola copia (Mi cuenta y el menú lateral): da de baja el celular para push,
 * revoca en el servidor (mejor esfuerzo; si no se pudo, lo dice), vacía la caché, borra la sesión
 * local y vuelve al login.
 */
export function useCerrarSesion() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()

  /** Antes da de baja el celular para push: después de revocar, el token de acceso ya no vale. */
  const revocarEnElServidor = async () => {
    await darDeBajaPushAntesDeSalir()
    const ok = await cerrarSesionEnElServidor()
    if (!ok) Alert.alert('Sesión cerrada solo aquí', AVISO_SESION_NO_CERRADA_EN_TODOS)
  }

  const cerrarSesion = async () => {
    await revocarEnElServidor()
    safeHaptics.notification('success')
    queryClient.clear()
    logout()
    router.replace('/login')
  }

  return { cerrarSesion, revocarEnElServidor }
}
