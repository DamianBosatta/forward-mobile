import { usePermissions } from '@/core/auth/RequirePermission'

/** La lista de deudores pide MOD_PAGOS:Read (`GET /deudas/clientes`), como la pestaña Deudas de la web. */
export function usePuedeVerDeudores(): boolean {
  return usePermissions().canRead('MOD_PAGOS')
}

/** El estado de cuenta en PDF o Excel pide MOD_CC:Read o MOD_CLIENTES:Read, como `GET .../estado-cuenta/export`. */
export function usePuedeExportarEstadoDeCuenta(): boolean {
  const { canRead } = usePermissions()
  return canRead('MOD_CC') || canRead('MOD_CLIENTES')
}
