// Mirrors forward-frontend/apps/web/src/features/logistica/viajes-logic.ts — keep in sync

/**
 * viajes-logic.ts — Pure logic for the Planificar Viaje screen.
 *
 * Extracted to a standalone module for unit-testability without importing React.
 * DOM-free: safe to use in React Native, tests, or any other non-browser context.
 *
 * Consumers:
 *   - app/(tabs)/logistica/viajes.tsx
 *   - src/features/logistica/__tests__/viajes-logic.test.ts
 */

import type { VentaEmpacada } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Local types (web imports @forward/api-client; mobile defines them inline)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParadaRequestDto {
  ventaId: string
  direccionDestino?: string | null
  latitud?: number
  longitud?: number
}

export interface CrearHojaRutaPayload {
  choferId: string
  vehiculoId: string
  fechaSalida: string
  paradas: ParadaRequestDto[]
  usuarioGeneradorId: string
  depositoId?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A stop in the ordered route list, enriched with its 1-based display index.
 * Used after the backend returns the ordered route.
 */
export interface OrderedStop {
  /** 1-based order from OrdenSugerido or client-side reorder. */
  orden: number
  ventaId: string
  clienteNombre: string
  direccion: string
  cantidadBultos: number
  latitud?: number | null
  longitud?: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the CrearHojaRutaPayload from the selected ventas empacadas,
 * chofer/vehiculo IDs, and the desired departure date.
 *
 * The backend optimizer will re-order the stops; the order sent here is the
 * client's preferred order (manual override pre-submit). The optimizer applies
 * its own ordering — manual reorder of the POST result is display-only (v1).
 *
 * Rules:
 * - Each venta maps to a ParadaRequestDto with ventaId + lat/lon (nullable).
 * - Ventas without coords are included (backend appends null-coord stops last).
 * - usuarioGeneradorId defaults to empty GUID when not available (server-side
 *   the command handler uses ICurrentUserService if needed).
 */
export function buildCrearHojaRutaPayload(
  ventas: VentaEmpacada[],
  choferId: string,
  vehiculoId: string,
  fechaSalida: Date,
  depositoId?: string | null,
  usuarioGeneradorId = '00000000-0000-0000-0000-000000000000',
): CrearHojaRutaPayload {
  const paradas: ParadaRequestDto[] = ventas.map((v) => ({
    ventaId: v.id ?? '',
    direccionDestino: v.direccion ?? null,
    latitud: v.latitude ?? undefined,
    longitud: v.longitude ?? undefined,
  }))

  return {
    choferId,
    vehiculoId,
    fechaSalida: fechaSalida.toISOString(),
    paradas,
    usuarioGeneradorId,
    depositoId: depositoId ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder helpers (client-side pre-submit or display order after creation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moves the item at `fromIndex` one position toward `direction` in the list.
 * Returns a new array with the item repositioned. No-ops at boundaries.
 *
 * @param items  Ordered list of stops.
 * @param fromIndex  0-based index of the item to move.
 * @param direction  'up' decreases the index; 'down' increases it.
 */
export function reorderStop<T>(items: T[], fromIndex: number, direction: 'up' | 'down'): T[] {
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
  if (toIndex < 0 || toIndex >= items.length) return items

  const result = [...items]
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}

/**
 * Assigns sequential 1-based `orden` values to an ordered list of stops.
 * Pure: returns a new array, does not mutate input.
 */
export function assignOrderNumbers(stops: Omit<OrderedStop, 'orden'>[]): OrderedStop[] {
  return stops.map((s, i) => ({ ...s, orden: i + 1 }))
}

/**
 * Converts VentaEmpacada[] (multi-select result) to OrderedStop[] for display.
 * Used to build the initial ordered list before calling the backend.
 */
export function ventasToOrderedStops(ventas: VentaEmpacada[]): OrderedStop[] {
  return ventas.map((v, i) => ({
    orden: i + 1,
    ventaId: v.id ?? '',
    clienteNombre: v.clienteNombre ?? '',
    direccion: v.direccion ?? '',
    cantidadBultos: v.cantidadBultos ?? 0,
    latitud: v.latitude,
    longitud: v.longitude,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that the minimum required fields are set before creating/starting a trip.
 * Returns an error message string if invalid, or null if ready.
 */
export function validateTripReadiness(
  choferId: string | null,
  vehiculoId: string | null,
  stops: unknown[],
): string | null {
  if (!choferId) return 'Seleccioná un chofer.'
  if (!vehiculoId) return 'Seleccioná un vehículo.'
  if (stops.length === 0) return 'Agregá al menos una parada.'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip execution helpers (chofer consola)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A minimal stop shape for trip-execution logic — only the fields needed
 * by allParadasReported / tripProgress, matching ParadaDto.estado (numeric).
 */
export interface ParadaExecutionState {
  /** Numeric estado: 1=Pendiente, 2=Entregado, 3=NoEntregado */
  estado?: number | null
}

/** EstadoParada numeric enum values (matches backend Domain.Enum.EstadoParada). */
export const EstadoParada = {
  Pendiente: 1,
  Entregado: 2,
  NoEntregado: 3,
} as const

/**
 * Returns true when every parada has been reported (estado is Entregado or NoEntregado).
 * Null or undefined estado is treated as Pendiente (not yet reported).
 * An empty list is considered all-reported (enables finalize for zero-stop edge case).
 */
export function allParadasReported(paradas: ParadaExecutionState[]): boolean {
  return paradas.every(
    (p) => p.estado === EstadoParada.Entregado || p.estado === EstadoParada.NoEntregado,
  )
}

/**
 * Returns `{ reported, total }` where `reported` = paradas with estado Entregado or NoEntregado.
 * Null or undefined estado is treated as Pendiente (not yet reported).
 * Useful for the "X / N paradas reportadas" progress indicator.
 */
export function tripProgress(paradas: ParadaExecutionState[]): { reported: number; total: number } {
  const total = paradas.length
  const reported = paradas.filter(
    (p) => p.estado === EstadoParada.Entregado || p.estado === EstadoParada.NoEntregado,
  ).length
  return { reported, total }
}
