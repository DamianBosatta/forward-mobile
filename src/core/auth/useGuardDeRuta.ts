import { useEffect } from 'react'
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { permisosDesde } from '@/features/auth/lib/permisos'
import { puedeAbrirPantalla } from './rutasDeLaApp'

/**
 * Control de ruta (ARQ-04, decisión #32): una pantalla que se abre por enlace (`forward://…`), por un push o desde
 * el código pide lo mismo que la misma ruta de la web. Sin permiso vuelve a Inicio, como el middleware de la web.
 * El menú ya no ofrece esas entradas; esto cubre los enlaces. Espera al perfil: sin él no hay con qué decidir.
 */
export function useGuardDeRuta(): void {
  const router = useRouter()
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const conSesion = useAuthStore((s) => s.isAuthenticated && !!s.accessToken)
  const permissions = useAuthStore((s) => s.user?.permissions)

  useEffect(() => {
    if (!conSesion || !permissions || !pathname) return
    if (!puedeAbrirPantalla(permisosDesde(permissions), pathname, params)) router.replace('/(tabs)')
  }, [conSesion, permissions, pathname, params, router])
}
