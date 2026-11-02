import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { safeHaptics } from '@/core/utils/haptics'
import { cerrarSesion as cerrarSesionEnElTelefono } from '@/features/auth/lib/cerrarSesion'
import { darDeBajaPushAntesDeSalir } from '@/features/notificaciones'
import { AVISO_SESION_NO_CERRADA_EN_TODOS, cerrarSesionEnElServidor } from '../api/cuenta'

/**
 * Cerrar sesión desde la pantalla (Mi cuenta y el menú lateral): da de baja el celular para push,
 * revoca en el servidor (mejor esfuerzo; si no se pudo, lo dice), borra todo lo de la sesión en el
 * teléfono con el único `cerrarSesion()` de auth y vuelve al login.
 */
export function useCerrarSesion() {
  const router = useRouter()

  /** Antes da de baja el celular para push: después de revocar, el token de acceso ya no vale. */
  const revocarEnElServidor = async () => {
    await darDeBajaPushAntesDeSalir()
    const ok = await cerrarSesionEnElServidor()
    if (!ok) Alert.alert('Sesión cerrada solo aquí', AVISO_SESION_NO_CERRADA_EN_TODOS)
  }

  const cerrarSesion = async () => {
    await revocarEnElServidor()
    safeHaptics.notification('success')
    await cerrarSesionEnElTelefono()
    router.replace('/login')
  }

  return { cerrarSesion, revocarEnElServidor }
}
