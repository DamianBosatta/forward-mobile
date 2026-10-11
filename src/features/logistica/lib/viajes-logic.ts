/**
 * viajes-logic.ts — Lógica pura de la ejecución del viaje (consola del chofer).
 *
 * La planificación de viajes (wizard, hoja de ruta nueva) está fuera del alcance
 * de mobile (Bloque 9A, PR 0.4).
 *
 * Consumers:
 *   - app/(tabs)/logistica/consola.tsx
 *   - src/features/logistica/__tests__/viajes-logic.test.ts
 */

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
