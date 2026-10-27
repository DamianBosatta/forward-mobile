import { usePermissions } from '@/core/auth/RequirePermission'

/**
 * "Vender" a un cliente ya elegido (Mi día, Buscar, la ficha del cliente): la ruta de la venta nueva con
 * `?clienteId=`. Devuelve null cuando no corresponde ofrecerlo: sin permiso para crear ventas (el mismo que usa
 * el "+" de AccesosRapidos).
 */
export function useVenderA(): ((clienteId: string) => string) | null {
  const { canDo } = usePermissions()
  if (!canDo('MOD_VENTAS', 'create')) return null
  return (clienteId) => `/(tabs)/ventas/nueva?clienteId=${encodeURIComponent(clienteId)}`
}
