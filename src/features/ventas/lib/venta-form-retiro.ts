/**
 * Pure logic helpers for the venta form — retiro-en-local / entregaInmediata support.
 *
 * Mirrors the web equivalent (forward-frontend/apps/web/src/features/ventas/lib/venta-form-retiro.ts)
 * so mobile and web UX behavior stay in sync.
 *
 * UX decision (design D8):
 *   - Default delivery method = Logística (1). Mobile already has a 3-way selector.
 *   - When entregaInmediata toggle is ON → MetodoEntrega is forced to RetiroEnLocal (2)
 *     and the method selector is disabled. This models a counter-sale ("mostrador").
 *   - When toggle is OFF → the user selects from the 3 available methods freely.
 *   - Out-of-stock guard: when toggle is ON, products with stockDisponible <= 0 cannot
 *     be added to the cart (UX enforcement; backend enforces the hard block per D4).
 *
 * Wire-format note (design D5):
 *   Mobile sends fechaEntrega as an ISO 8601 datetime string (Date.toISOString()),
 *   NOT web's YYYY-MM-DD date string. esFechaEntregaValida accepts a Date object
 *   directly (not a string) to match how the DateTimePicker produces values.
 *
 * All functions are framework-agnostic — safe to use in React Native, tests,
 * or any other context without side effects.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Numeric enum values for MetodoEntrega — mirrors the backend C# enum. */
export const METODO_ENTREGA = {
  Logistica: 1,
  RetiroEnLocal: 2,
  Expreso: 3,
} as const

export type MetodoEntregaValue = (typeof METODO_ENTREGA)[keyof typeof METODO_ENTREGA]

// ─────────────────────────────────────────────────────────────────────────────
// resolveMetodoEntrega
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the effective MetodoEntrega value for the create-venta payload.
 *
 * When entregaInmediata is true (counter-sale / "venta directa"), the method is
 * always forced to RetiroEnLocal regardless of what the selector shows. The
 * backend also enforces this (D1b), but we replicate it here for a consistent
 * UX (selector is disabled while toggle is ON).
 *
 * When entregaInmediata is false, the user's selected method is returned as-is.
 */
export function resolveMetodoEntrega(
  entregaInmediata: boolean,
  selectedMethod: MetodoEntregaValue = METODO_ENTREGA.Logistica,
): MetodoEntregaValue {
  return entregaInmediata ? METODO_ENTREGA.RetiroEnLocal : selectedMethod
}

// ─────────────────────────────────────────────────────────────────────────────
// isProductAddable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns whether a product can be added to the cart in the current sale mode.
 *
 * When entregaInmediata is true: products with stockDisponible <= 0 cannot be
 * added (UX enforcement of the backend hard-block — spec S3, D4, D8).
 * When entregaInmediata is false: any product can be added regardless of stock
 * (normal path: server may create a PendienteAutorizacion sale without stock).
 *
 * @param entregaInmediata - whether the "venta directa" counter-sale toggle is active
 * @param stockDisponible  - available stock (real - reserved)
 */
export function isProductAddable(entregaInmediata: boolean, stockDisponible: number): boolean {
  if (entregaInmediata) {
    return stockDisponible > 0
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// requiereFechaEntrega
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true iff the effective delivery method requires a delivery date.
 *
 * The backend validator enforces: `FechaEntrega NotEmpty When MetodoEntrega != RetiroEnLocal`.
 * We mirror that rule on the client to show/validate the date field before submit.
 *
 * When entregaInmediata is ON, resolveMetodoEntrega forces RetiroEnLocal, so the
 * result is always false (backend sets fecha = now for immediate sales itself).
 *
 * @param entregaInmediata - toggle state from local component state
 * @param selectedMethod   - method chosen in the selector
 */
export function requiereFechaEntrega(
  entregaInmediata: boolean,
  selectedMethod: MetodoEntregaValue = METODO_ENTREGA.Logistica,
): boolean {
  const effective = resolveMetodoEntrega(entregaInmediata, selectedMethod)
  return effective !== METODO_ENTREGA.RetiroEnLocal
}

// ─────────────────────────────────────────────────────────────────────────────
// esFechaEntregaValida
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true iff the given Date is a valid non-Sunday calendar date.
 *
 * Mirrors the backend constraint: `No se permiten entregas los domingos`.
 *
 * Mobile wire-format note: unlike the web variant (which takes a YYYY-MM-DD string
 * from an <input type="date">), mobile receives a Date object from DateTimePicker.
 * We call getDay() directly on the Date — no string parsing needed — which avoids
 * any UTC vs. local-time ambiguity because the DateTimePicker already constructs
 * the Date in local time.
 *
 * @param fecha - the Date selected by the DateTimePicker, or null/undefined if none selected
 */
export function esFechaEntregaValida(fecha: Date | null | undefined): boolean {
  if (!fecha) return false
  // getDay() === 0 is Sunday.
  return fecha.getDay() !== 0
}

// ─────────────────────────────────────────────────────────────────────────────
// buildVentaPayload
// ─────────────────────────────────────────────────────────────────────────────

export interface VentaFormData {
  clienteId: string
  depositoId: string
  tipoOperacion: number
  descuentoGeneral: number
  /**
   * Freight charge to include in the payload (e.g. fleteMonto computed in the screen).
   * When > 0, included as cargoFlete in the payload.
   * When 0/undefined, cargoFlete is omitted from the payload.
   */
  cargoFlete?: number
  /**
   * Delivery date selected by the DateTimePicker.
   * Formatted as ISO 8601 datetime string (toISOString()) in the payload.
   * Only included when requiereFechaEntrega is true and a date is present.
   */
  fechaEntrega?: Date | null
  detalles: Array<{
    productoId: string
    cantidad: number
    descuentoPorcentaje?: number
  }>
}

export interface VentaCreatePayload {
  clienteId: string
  depositoId: string
  tipoOperacion: number
  descuentoGeneral: number
  metodoEntrega: MetodoEntregaValue
  entregaInmediata: boolean
  /**
   * Freight charge. Only present when > 0.
   * Backend treats 0/absent as null (no flete).
   */
  cargoFlete?: number
  /**
   * ISO 8601 datetime string (toISOString()).
   * Only present when requiereFechaEntrega is true and a date is provided.
   * Mobile uses datetime format (not YYYY-MM-DD) to match the existing wire format.
   */
  fechaEntrega?: string
  items: Array<{
    productoId: string
    cantidad: number
    descuentoPorcentaje: number
  }>
}

/**
 * Builds the CreateVentaRequest payload from the form data and the current
 * entregaInmediata / metodoEntrega state.
 *
 * Centralizing payload construction here keeps the form's onSubmit lean and
 * makes the logic independently verifiable.
 *
 * fechaEntrega is included in the payload ONLY when requiereFechaEntrega is true
 * AND a Date is present in formData. It is formatted as an ISO 8601 datetime
 * string (Date.toISOString()), preserving the existing mobile wire format.
 *
 * cargoFlete is included in the payload ONLY when formData.cargoFlete > 0.
 *
 * @param formData         - form field values (including fleteMonto as cargoFlete)
 * @param entregaInmediata - toggle state from local component state
 * @param selectedMethod   - method chosen in the selector (ignored when toggle is ON)
 */
export function buildVentaPayload(
  formData: VentaFormData,
  entregaInmediata: boolean,
  selectedMethod: MetodoEntregaValue = METODO_ENTREGA.Logistica,
): VentaCreatePayload {
  const needsDate = requiereFechaEntrega(entregaInmediata, selectedMethod)

  const payload: VentaCreatePayload = {
    clienteId: formData.clienteId,
    depositoId: formData.depositoId,
    tipoOperacion: formData.tipoOperacion,
    descuentoGeneral: formData.descuentoGeneral,
    metodoEntrega: resolveMetodoEntrega(entregaInmediata, selectedMethod),
    entregaInmediata,
    items: formData.detalles.map((d) => ({
      productoId: d.productoId,
      cantidad: d.cantidad,
      descuentoPorcentaje: d.descuentoPorcentaje ?? 0,
    })),
  }

  // fechaEntrega: ISO datetime string, only for delivery methods that require a date.
  if (needsDate && formData.fechaEntrega) {
    payload.fechaEntrega = formData.fechaEntrega.toISOString()
  }

  // cargoFlete: only include when a positive freight amount is present.
  if (formData.cargoFlete && formData.cargoFlete > 0) {
    payload.cargoFlete = formData.cargoFlete
  }

  return payload
}
