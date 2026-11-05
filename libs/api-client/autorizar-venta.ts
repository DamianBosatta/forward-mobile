export interface BuildAutorizarPayloadInput {
  ventaId: string
  version: number
  /** Razón; se recorta. Obligatoria solo con margen en amarillo (lo decide el servidor). */
  razon?: string | null
  /** Puntos de descuento que se dan al autorizar; null o ausente = ninguno. */
  descuentoAdicionalPorcentaje?: number | null
  /** Líneas que el que autoriza baja o quita (0 = quitar); vacío o ausente = sin cambios. */
  ajustes?: AjusteDeLinea[]
}

/** `AjusteLineaAutorizacionDto` del contrato: solo baja la cantidad o quita la línea. */
export interface AjusteDeLinea {
  ventaDetalleId: string
  cantidadNueva: number
}

export interface AutorizarPayload {
  ventaId: string
  version: number
  /** null si no hay: el validador del servidor rechaza una razón vacía o en blanco. */
  razon: string | null
  /** Solo si se da: el servidor rechaza un 0. */
  descuentoAdicionalPorcentaje?: number
  /** Solo si hay cambios: sin ajustes el pedido es el de siempre. */
  ajustes?: AjusteDeLinea[]
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
    ...(input.ajustes && input.ajustes.length > 0 ? { ajustes: input.ajustes } : {}),
  }
}
