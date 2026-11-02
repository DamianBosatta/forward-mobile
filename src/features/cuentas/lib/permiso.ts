import { usePermissions } from '@/core/auth/RequirePermission'

/** Quien puede registrar un cobro de cliente (POST de pagos: MOD_PAGOS crear + leer). Una sola copia de la regla (X1). */
export function usePuedeCobrar(): boolean {
  const { canCreate, canRead } = usePermissions()
  return canCreate('MOD_PAGOS') && canRead('MOD_PAGOS')
}

/**
 * Quien puede transferir entre cuentas propias: cuentas propias (MOD_CC leer), tipos de cuenta (MOD_PAGOS leer)
 * y el POST de la transferencia (MOD_PAGOS crear). Una sola copia de la regla (X1).
 */
export function usePuedeTransferir(): boolean {
  const { canCreate, canRead } = usePermissions()
  return canCreate('MOD_PAGOS') && canRead('MOD_PAGOS') && canRead('MOD_CC')
}
