import { usePermissions } from '@/core/auth/RequirePermission'

/**
 * Quien ve la lista de pagos y cobros: la misma regla que la ruta `/finanzas/pagos` de la web (MOD_PAGOS:Read más
 * CAP_VER_TESORERIA, `permisos.ts`). Registrar un pago es la regla del cobro (`usePuedeCobrar`): el POST es el mismo.
 */
export function usePuedeVerPagos(): boolean {
  const { canRead, hasCapability } = usePermissions()
  return canRead('MOD_PAGOS') && hasCapability('CAP_VER_TESORERIA')
}
