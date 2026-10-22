import { usePermissions } from '@/core/auth/RequirePermission'
import { useVentaNueva } from '@/features/ventas/lib/ventaNueva'

/**
 * "Vender" a un cliente ya elegido (Mi día, Buscar, la ficha del cliente): la ruta de la venta nueva con
 * `?clienteId=`. Devuelve null cuando no corresponde ofrecerlo: switch de la venta nueva apagado (la venta de hoy
 * no recibe cliente) o sin permiso para crear ventas (el mismo que usa el "+" de AccesosRapidos).
 */
export function useVenderA(): ((clienteId: string) => string) | null {
  const ventaNueva = useVentaNueva()
  const { canDo } = usePermissions()
  if (!ventaNueva || !canDo('MOD_VENTAS', 'create')) return null
  return (clienteId) => `/(tabs)/ventas/nueva-v2?clienteId=${encodeURIComponent(clienteId)}`
}
