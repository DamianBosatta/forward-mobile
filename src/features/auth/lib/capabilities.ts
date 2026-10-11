import type { ModulePermission } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Capacidades otorgables (CAP_*) — espejo de Domain.Constants.AppCapabilities
//
// Llegan en el MISMO array que los módulos: GET /api/v1/users/me/permissions devuelve
// "CAP_VER_COSTOS:Read" (PermissionService.GetUserPermissionsAggregatedAsync) y
// parsePermissionsFromArray lo deja como { module: 'CAP_VER_COSTOS', canRead: true }.
// El super-admin las recibe igual: el backend le agrega el catálogo completo en esa misma
// respuesta, así que acá no hay bypass por rol.
//
// UX solamente (defensa en profundidad): el servidor ya redacta costos y márgenes a quien
// no tiene la capacidad. Fail-closed: sin la fila con canRead=true, no hay capacidad.
// ─────────────────────────────────────────────────────────────────────────────

/** Las que mobile consulta hoy; el catálogo completo vive en AppCapabilities.cs. */
export type AppCapability = 'CAP_VER_COSTOS' | 'CAP_AUTORIZAR_VENTA' | 'CAP_EXENTO_TOPE_DESCUENTO'

/**
 * ¿`permissions` incluye la capacidad? Compara sin distinguir mayúsculas, igual que
 * `PermissionService.HasPermissionAsync` (OrdinalIgnoreCase) en el backend.
 */
export function hasCapability(
  permissions: ModulePermission[] | null | undefined,
  capability: AppCapability,
): boolean {
  return (permissions ?? []).some(
    (p) => p.module?.toUpperCase() === capability && p.canRead === true,
  )
}
