import type { ModulePermission } from '@/libs/api-client/types'
import { permisosDesde } from './permisos'

// ─────────────────────────────────────────────────────────────────────────────
// Capacidades otorgables (CAP_*) — espejo de Domain.Constants.AppCapabilities
//
// Llegan en el MISMO array que los módulos: GET /api/v1/users/me/permissions devuelve
// "CAP_VER_COSTOS:Read" (PermissionService.GetUserPermissionsAggregatedAsync) y
// parsePermissionsFromArray lo deja como { module: 'CAP_VER_COSTOS', canRead: true }.
// El super-admin las recibe igual: el backend le agrega el catálogo completo en esa misma
// respuesta, así que acá no hay bypass por rol.
//
// UX solamente (defensa en profundidad): el servidor decide igual. Fail-closed: sin la fila con
// canRead=true, no hay capacidad (permisosDesde, C-004).
// ─────────────────────────────────────────────────────────────────────────────

/** Las que mobile consulta hoy; el catálogo completo vive en AppCapabilities.cs. */
export type AppCapability =
  | 'CAP_VER_COSTOS'
  | 'CAP_AUTORIZAR_VENTA'
  | 'CAP_EXENTO_TOPE_DESCUENTO'
  | 'CAP_ANULAR_RECEPCION_COMPRAS'
  | 'CAP_VER_CANTIDADES_STOCK'
  | 'CAP_GESTIONAR_CHEQUES'
  | 'CAP_APROBAR_CAMBIOS_SOCIO'
  | 'CAP_ARMAR_VIAJES'
  | 'CAP_VER_TESORERIA'

/** ¿`permissions` incluye la capacidad? */
export function hasCapability(
  permissions: ModulePermission[] | null | undefined,
  capability: AppCapability,
): boolean {
  return permisosDesde(permissions).tiene(capability)
}
