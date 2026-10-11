/**
 * Pure authorization-flow helpers for the below-floor venta authorization feature.
 *
 * PR-2e-b: all functions are framework-agnostic — safe in React Native, tests,
 * or any other context without side effects.
 */

import type { ModulePermission } from '@/libs/api-client/types'
import { hasCapability } from '@/features/auth/lib/capabilities'

// ─────────────────────────────────────────────────────────────────────────────
// canAuthorizeVenta — combined estado + CAP_AUTORIZAR_VENTA gate
// ─────────────────────────────────────────────────────────────────────────────

/** Estado values that require authorization (numeric string from backend). */
const AUTHORIZATION_STATES = new Set(['9', 'PendienteAutorizacion'])

/**
 * Returns true when the user is allowed to see and trigger the Autorizar action.
 *
 * Gate: estado is '9' / 'PendienteAutorizacion' AND the user holds CAP_AUTORIZAR_VENTA.
 * Antes se colgaba de canViewCost (rol); autorizar no es ver costos, y el backend contesta
 * 403 chequeando CAP_AUTORIZAR_VENTA. Mirrors web canAutorizarVenta(permissions).
 * Server is authoritative — this is UX-only (defense in depth).
 *
 * @param estado      - Venta estado value (numeric string or enum string from backend)
 * @param permissions - `user.permissions` from the mobile auth store
 */
export function canAuthorizeVenta(
  estado: string | number,
  permissions: ModulePermission[] | null | undefined,
): boolean {
  return AUTHORIZATION_STATES.has(String(estado)) && hasCapability(permissions, 'CAP_AUTORIZAR_VENTA')
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
