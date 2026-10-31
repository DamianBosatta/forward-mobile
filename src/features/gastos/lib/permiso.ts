import { usePermissions } from '@/core/auth/RequirePermission'

/**
 * ¿Puede pagar un servicio? Lo mismo que pide el servidor: `POST /gastos` es MOD_PAGOS:Create y la lista de
 * conceptos (`GET /gastos/tipos-gasto`) pide MOD_PAGOS:Read más CAP_VER_TESORERIA. No define permisos nuevos.
 */
export function usePuedePagarServicio(): boolean {
  const { canDo, canRead, hasCapability } = usePermissions()
  return canDo('MOD_PAGOS', 'create') && canRead('MOD_PAGOS') && hasCapability('CAP_VER_TESORERIA')
}
