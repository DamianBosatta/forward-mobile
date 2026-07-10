/**
 * Pure helpers for sale profitability (S4 — corrected additive formula) — mobile implementation.
 *
 * Formula documentation (IDENTICAL to web implementation in
 * forward-frontend/apps/web/src/features/ventas/lib/rentabilidad-venta.ts):
 *
 *   costoTotal  = Σ precioCostoSnapshot * cantidad
 *   ingresoNeto = subtotalBruto - montoDescuento   (post-general-discount; EXCLUDES flete)
 *   margenNeto  = ingresoNeto - costoTotal
 *   margenPct   = ingresoNeto > 0 ? (margenNeto / ingresoNeto) * 100 : 0
 *
 * Why this formula:
 * - The old approach multiplied gross margin by a (totalAmount / subtotalBruto) factor.
 *   That was wrong in two ways:
 *     1. totalAmount includes CargoFlete (pass-through cost with no cost line), which
 *        inflated the factor and therefore overstated the margin.
 *     2. Multiplying the gross margin by the discount factor is algebraically wrong:
 *        the general discount reduces REVENUE only, not cost. Example: subtotal=1000,
 *        cost=600, gral=20% → old gives 400×0.8=320; correct answer is 800-600=200.
 * - The additive formula computes revenue and cost independently, then subtracts.
 *   Flete is excluded by construction (never added to ingresoNeto).
 *
 * Do NOT diverge from the web formula — changes must be applied to both files.
 * Do NOT round intermediate values — only round for display.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RentabilidadDetalleInput {
  /** Post-item-discount unit price (VentaDetalleItemDto.precioUnitario). */
  precioUnitario: number
  /**
   * Cost snapshot from the server. Non-null for cost roles (Administrador,
   * AdministradorSistemas, Gerente); null for non-cost roles (server-redacted).
   */
  precioCostoSnapshot: number | null | undefined
  cantidad: number
}

export interface RentabilidadInput {
  detalles: RentabilidadDetalleInput[]
  /**
   * Sum of post-item-discount line subtotals (pre-general-discount).
   * VentaHeaderDto.subtotalBrutoAmount.
   * When subtotalBruto === 0 the result is null (guard against zero-revenue sale).
   */
  subtotalBruto: number
  /**
   * General discount amount applied to the header (MontoDescuentoAmount).
   * ingresoNeto = subtotalBruto - montoDescuento.
   * Does NOT include CargoFlete — flete is excluded by construction.
   */
  montoDescuento: number
}

export interface RentabilidadVentaResult {
  /** Net earned margin in currency units: ingresoNeto - costoTotal. */
  margenNeto: number
  /** Margin as a percentage of net product revenue: margenNeto / ingresoNeto * 100. */
  margenPct: number
}

// ─────────────────────────────────────────────────────────────────────────────
// calcularRentabilidadVenta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the realized sale profitability from the venta detail lines.
 *
 * Returns null when:
 *   - detalles is empty
 *   - any line has null/undefined precioCostoSnapshot (non-cost role or data not loaded)
 *   - subtotalBruto is 0 (guard against zero-revenue sale)
 *
 * When ingresoNeto is 0 (e.g. 100% general discount), margenPct is 0 (not -Infinity).
 *
 * Formula is shared with the web implementation — do NOT diverge.
 */
export function calcularRentabilidadVenta(
  input: RentabilidadInput,
): RentabilidadVentaResult | null {
  const { detalles, subtotalBruto, montoDescuento } = input

  if (detalles.length === 0) return null
  if (subtotalBruto === 0) return null

  // All lines must have cost data (cost role gate)
  for (const d of detalles) {
    if (d.precioCostoSnapshot == null) return null
  }

  // Total cost of all lines
  let costoTotal = 0
  for (const d of detalles) {
    costoTotal += (d.precioCostoSnapshot as number) * d.cantidad
  }

  // Net product revenue: post-general-discount, flete excluded by construction
  const ingresoNeto = subtotalBruto - montoDescuento

  const margenNeto = ingresoNeto - costoTotal
  const margenPct = ingresoNeto > 0 ? (margenNeto / ingresoNeto) * 100 : 0

  return { margenNeto, margenPct }
}

// ─────────────────────────────────────────────────────────────────────────────
// puedeVerRentabilidad — gating helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true iff the detalles array is non-empty AND every line has a
 * non-null precioCostoSnapshot.
 *
 * Driven purely by data presence (field from server) — does NOT check role names.
 * The server is the authority: cost roles receive non-null values; non-cost roles
 * receive null for every line.
 *
 * Mirror: web `puedeVerRentabilidad` in rentabilidad-venta.ts.
 */
export function puedeVerRentabilidad(
  detalles: RentabilidadDetalleInput[],
): boolean {
  if (detalles.length === 0) return false
  return detalles.every((d) => d.precioCostoSnapshot != null)
}
