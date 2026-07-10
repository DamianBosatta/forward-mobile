// Mirrors forward-frontend/apps/web/src/features/logistica/picking-board-logic.ts — keep in sync

/**
 * picking-board-logic.ts — Pure logic extracted from the picking board component.
 *
 * Extracted to a standalone module so it can be unit-tested without importing
 * React components. DOM-free: safe to use in React Native, tests, or any other
 * non-browser context.
 *
 * Consumers:
 *   - app/(tabs)/logistica/picking.tsx
 *   - src/features/logistica/__tests__/picking-board-logic.test.ts
 */

import type { VentaPreparacion } from '@/libs/api-client/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Estado constants
// ─────────────────────────────────────────────────────────────────────────────

/** EstadoVenta integer values used by the board columns. */
export const ESTADO = {
  A_PREPARAR: 2,     // Confirmada
  EN_PREPARACION: 3, // EnPreparacion
  EMPACADOS: 4,      // Empacada
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Column partitioning
// ─────────────────────────────────────────────────────────────────────────────

export interface PickingColumns {
  aPreparar: VentaPreparacion[]
  enPreparacion: VentaPreparacion[]
  empacados: VentaPreparacion[]
}

/**
 * Partitions a flat list of VentaPreparacion into the 3 board columns
 * by estado integer value:
 *   2 (Confirmada)    → aPreparar
 *   3 (EnPreparacion) → enPreparacion
 *   4 (Empacada)      → empacados
 *
 * Ventas with states outside [2,3,4] are silently excluded.
 */
export function partitionByEstado(ventas: VentaPreparacion[]): PickingColumns {
  const aPreparar: VentaPreparacion[] = []
  const enPreparacion: VentaPreparacion[] = []
  const empacados: VentaPreparacion[] = []

  for (const v of ventas) {
    if (v.estado === ESTADO.A_PREPARAR) aPreparar.push(v)
    else if (v.estado === ESTADO.EN_PREPARACION) enPreparacion.push(v)
    else if (v.estado === ESTADO.EMPACADOS) empacados.push(v)
    // else: unknown estado — silently exclude
  }

  return { aPreparar, enPreparacion, empacados }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the cantidadBultos field in the "Marcar preparado" modal.
 *
 * Rules (spec Domain 3):
 *   - Must be a non-empty string that parses to an integer
 *   - Integer must be ≥ 1
 *
 * Returns an error string if invalid, or null if valid.
 */
export function validateCantidadBultos(value: string): string | null {
  if (value.trim() === '') return 'Ingresá una cantidad.'
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 'Ingresá un número válido.'
  if (n < 1) return 'La cantidad debe ser al menos 1.'
  return null
}
