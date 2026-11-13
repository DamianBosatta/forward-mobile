import { useAuthStore } from '@/features/auth/store/auth.store'
import { useAvisosEnVivo } from './useAvisosEnVivo'

/** Una conexión de avisos por app, mientras hay sesión. Se monta una vez en el layout raíz. */
export function AvisosEnVivo() {
  const autenticado = useAuthStore((s) => s.isAuthenticated && !!s.accessToken)
  useAvisosEnVivo(autenticado)
  return null
}
