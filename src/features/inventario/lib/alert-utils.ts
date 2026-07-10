/**
 * Pure alert-derivation helpers for the inventario feature (mobile).
 *
 * Mirrors web alert-utils.ts — both production code and tests must import
 * from this file, never copy logic inline (prevents silent divergence).
 */

import type { StockItem } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// derivarEstadoAlerta
// ─────────────────────────────────────────────────────────────────────────────

export interface EstadoAlerta {
  enAlerta: boolean
  agotado: boolean
  stockBajo: boolean
}

/**
 * Derives the alert state for a stock item using the server `enAlerta` flag
 * as the primary signal, with a client-side fallback for legacy payloads.
 *
 * Server is authoritative — `enAlerta` from the API takes precedence.
 * The disponible-based fallback is only used when `enAlerta` is undefined.
 */
export function derivarEstadoAlerta(item: Pick<StockItem, 'enAlerta' | 'cantidadDisponible' | 'stockMinimo' | 'cantidadActual' | 'cantidadReservada'>): EstadoAlerta {
  const disponible =
    item.cantidadDisponible ??
    ((item.cantidadActual ?? 0) - (item.cantidadReservada ?? 0))

  const agotado = disponible <= 0
  const stockBajo = !agotado && disponible <= (item.stockMinimo ?? 10)

  // Server flag is authoritative when present
  const enAlerta =
    item.enAlerta !== undefined && item.enAlerta !== null
      ? item.enAlerta
      : agotado || stockBajo

  return { enAlerta, agotado, stockBajo }
}

// ─────────────────────────────────────────────────────────────────────────────
// filtrarSoloEnAlerta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters a list to only items where `enAlerta` is truthy.
 * Used by the "Solo en alerta" toggle on the list screen.
 */
export function filtrarSoloEnAlerta(items: StockItem[]): StockItem[] {
  return items.filter((item) => item.enAlerta === true)
}
