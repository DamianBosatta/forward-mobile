/**
 * Pure authorization-flow helpers for the below-floor venta authorization feature.
 *
 * PR-2e-b: all functions are framework-agnostic — safe in React Native, tests,
 * or any other context without side effects.
 */

import { canViewCost } from './descuentos'

// ─────────────────────────────────────────────────────────────────────────────
// canAuthorizeVenta — combined estado + cost-role gate
// ─────────────────────────────────────────────────────────────────────────────

/** Estado values that require authorization (numeric string from backend). */
const AUTHORIZATION_STATES = new Set(['9', 'PendienteAutorizacion'])

/**
 * Returns true when the user is allowed to see and trigger the Autorizar action.
 *
 * Gate: estado is '9' / 'PendienteAutorizacion' AND the user holds a cost role
 * (Administrador | AdministradorSistemas | Gerente).
 *
 * Mirrors web venta-detail-client.tsx: `estadoStr === '9' && canViewCost(userRoles)`.
 * Server is authoritative — this is UX-only (defense in depth).
 *
 * @param estado  - Venta estado value (numeric string or enum string from backend)
 * @param roles   - User role array from the mobile auth store
 */
export function canAuthorizeVenta(estado: string | number, roles: string[]): boolean {
  return AUTHORIZATION_STATES.has(String(estado)) && canViewCost(roles)
}

// ─────────────────────────────────────────────────────────────────────────────
// buildAutorizarPayload — constructs the POST /autorizar request body
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildAutorizarPayloadInput {
  ventaId: string
  version: number
  /** Mandatory reason; whitespace will be trimmed. */
  razon: string
}

export interface AutorizarPayload {
  ventaId: string
  version: number
  razon: string
}

/**
 * Builds the POST body for the Autorizar endpoint.
 *
 * The server derives actor identity and role exclusively from the JWT token —
 * `usuarioId` and `isAdminUser` are NOT sent. Trims `razon` whitespace.
 */
export function buildAutorizarPayload(input: BuildAutorizarPayloadInput): AutorizarPayload {
  return {
    ventaId: input.ventaId,
    version: input.version,
    razon: input.razon.trim(),
  }
}
