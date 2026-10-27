export interface BuildAutorizarPayloadInput {
  ventaId: string
  version: number
  /** Razón; se recorta. Obligatoria solo con margen en amarillo (lo decide el servidor). */
  razon?: string | null
  /** Puntos de descuento que se dan al autorizar; null o ausente = ninguno. */
  descuentoAdicionalPorcentaje?: number | null
}

export interface AutorizarPayload {
  ventaId: string
  version: number
  /** null si no hay: el validador del servidor rechaza una razón vacía o en blanco. */
  razon: string | null
  /** Solo si se da: el servidor rechaza un 0. */
  descuentoAdicionalPorcentaje?: number
}

/**
 * Builds the POST body for the Autorizar endpoint.
 *
 * The server derives actor identity and role exclusively from the JWT token —
 * `usuarioId` and `isAdminUser` are NOT sent. Trims `razon`; sin texto va null.
 */
export function buildAutorizarPayload(input: BuildAutorizarPayloadInput): AutorizarPayload {
  const razon = input.razon?.trim() ?? ''
  return {
    ventaId: input.ventaId,
    version: input.version,
    razon: razon.length > 0 ? razon : null,
    ...(input.descuentoAdicionalPorcentaje != null ? { descuentoAdicionalPorcentaje: input.descuentoAdicionalPorcentaje } : {}),
  }
}
