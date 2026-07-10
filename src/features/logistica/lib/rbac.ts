/**
 * rbac.ts — RBAC constants and helpers for the logistics module.
 *
 * MGMT_ROLES defines which roles have access to management-only screens
 * (Planificar Viaje, ABM Vehículos). Mirrors the web middleware configuration
 * for MOD_VIAJES + management role gating.
 *
 * Any MOD_VIAJES:read holder (including non-management Empleado users) can
 * access the Picking Board and Consola screens — no additional role check needed
 * for those screens beyond RequirePermission module="MOD_VIAJES" action="read".
 */

export const MGMT_ROLES = ['Administrador', 'AdministradorSistemas', 'Gerencia'] as const

export type MgmtRole = typeof MGMT_ROLES[number]

/**
 * Returns true if any of the user's roles is a management role.
 * Used to gate Planificar Viaje and ABM Vehículos screens and hub nav cards.
 */
export function isMgmtRole(roles: string[]): boolean {
  return roles.some((r) => MGMT_ROLES.includes(r as MgmtRole))
}
