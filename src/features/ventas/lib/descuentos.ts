/**
 * Pure client-side discount helpers for the venta form.
 *
 * PR-2e-a unification (REQ-BANDS-03): there is ONE profitability floor for ALL roles,
 * the server-computed `precioMinimo` (= PrecioMinimoRentable). The backend returns it
 * to every role — cost and non-cost alike — so the client never recomputes the floor.
 * The old cost-role recompute `precioCompraBase * (1 + margenGlobal)` was a stale,
 * laxer floor (it ignored flete / percepciones / ratio) and disagreed with the
 * server semáforo; it has been RETIRED — mirrors web es-descuento-valido.ts.
 *
 * `precioCompraBase` / `margenGlobal` are NO LONGER inputs to the floor decision.
 * They may still be displayed to cost roles for information, but never used for floor math.
 *
 * All functions are framework-agnostic — safe to use in React Native, tests,
 * or any other context without side effects.
 */

// ─────────────────────────────────────────────────────────────────────────────
// esPrecioValido — the single unified floor primitive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified floor guard for ALL roles.
 *
 * Valid iff `precioFinal >= precioMinimo` (inclusive at the floor — matches the
 * server VERDE-at-floor convention). `precioMinimo` is the server-computed
 * PrecioMinimoRentable received from catalogo-stock / Productos/{id}.
 *
 * Server is authoritative: this is UX-only (defense in depth).
 *
 * @param precioFinal   - The discounted price the user wants to apply
 * @param precioMinimo  - Server-computed floor (PrecioMinimoRentable)
 */
export function esPrecioValido(precioFinal: number, precioMinimo: number): boolean {
  return precioFinal >= precioMinimo
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtotal with per-item discount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates a cart line's subtotal applying a per-item percentage discount.
 *
 * @param precioVenta     - Unit selling price (base, before discount)
 * @param cantidad        - Quantity
 * @param descuentoPct    - Per-item discount percentage (0–100)
 */
export function calcularSubtotalConDescuento(
  precioVenta: number,
  cantidad: number,
  descuentoPct: number,
): number {
  const precioFinal = precioVenta * (1 - descuentoPct / 100)
  return precioFinal * cantidad
}

// ─────────────────────────────────────────────────────────────────────────────
// Bidirectional discount helpers (ADR-5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the discount percentage from a base price and final price.
 * Two-way binding helper (ADR-5): editing the price field calls this to
 * update the % field.
 *
 * pct = (1 - precioFinal / precioVenta) * 100, rounded to 2 decimal places.
 * Guard: returns 0 when precioVenta is 0 or negative to avoid division by zero.
 *
 * @param precioVenta  - Base selling price (must be > 0)
 * @param precioFinal  - Discounted price entered by the user
 */
export function pctFromPrecio(precioVenta: number, precioFinal: number): number {
  if (precioVenta <= 0) return 0
  const raw = (1 - precioFinal / precioVenta) * 100
  return Math.round(raw * 100) / 100
}

/**
 * Computes the discounted price from a base price and discount percentage.
 * Two-way binding helper (ADR-5): editing the % field calls this to update
 * the price field.
 *
 * price = precioVenta * (1 - pct / 100), rounded to 2 decimal places.
 *
 * @param precioVenta  - Base selling price
 * @param pct          - Discount percentage (0–100)
 */
export function precioFromPct(precioVenta: number, pct: number): number {
  const raw = precioVenta * (1 - pct / 100)
  return Math.round(raw * 100) / 100
}

/**
 * Client-side UX mirror of AppRoles.CostViewingRoles.
 * Returns true if any role in the array is a cost-authorized role.
 *
 * Cost roles: Administrador, AdministradorSistemas, Gerencia.
 * Server is authoritative — this function is UX only (defense in depth).
 *
 * IMPORTANT: keep in sync with AppRoles.CostViewingRoles in
 * Domain/Constants/AppRoles.cs.
 *
 * Note: cost roles can SEE cost info (precioCompraBase) for display, but the
 * profitability floor is the same single server floor for all roles (PR-2e-a).
 *
 * @param roles - Array of role name strings from the mobile auth store
 */
const COST_VIEWING_ROLES = new Set(['Administrador', 'AdministradorSistemas', 'Gerencia'])

export function canViewCost(roles: string[]): boolean {
  return roles.some((r) => COST_VIEWING_ROLES.has(r))
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound floor guard — single server floor for every role
// ─────────────────────────────────────────────────────────────────────────────

export interface EsDescuentoValidoCompuestoInput {
  /** Per-item discount percentage (0–100) */
  descItemPct: number
  /** General (sale-level) discount percentage (0–100) */
  descGeneralPct: number
  /** Base selling price (before any discount) */
  precioVenta: number
  /**
   * Server-computed profitability floor (PrecioMinimoRentable).
   * The SINGLE floor for all roles. When null/undefined the floor is unknown.
   */
  precioMinimo?: number | null
}

/**
 * Compound floor guard — single server floor (PrecioMinimoRentable) for every role.
 *
 * Computes: effective = precioVenta * (1 - descItemPct/100) * (1 - descGeneralPct/100)
 *
 * ROUNDING CONVENTION:
 *   - Compare UNROUNDED effective vs the floor.
 *   - No Math.round before the >= comparison.
 *   - Rounding to currency precision is for display/persistence only.
 *
 * Floor: `precioMinimo` (server-computed, includes margin + flete + percepciones + ratio).
 * Inclusive at floor: effective >= precioMinimo is OK (matches server VERDE-at-floor).
 *
 * Null-floor policy (REQ-BANDS-03): when precioMinimo is null/undefined the floor is
 * unknown — fail-OPEN (return true). The cart/modal UX is purely advisory; an unknown
 * floor must NOT alarm or block. The server routes/rejects at submit time.
 *
 * @returns true when discounted price stays at or above the floor, false when it pierces it.
 */
export function esDescuentoValidoCompuesto(input: EsDescuentoValidoCompuestoInput): boolean {
  const { descItemPct, descGeneralPct, precioVenta, precioMinimo } = input

  // Compound effective price — unrounded, single multiply chain
  const efectivo = precioVenta * (1 - descItemPct / 100) * (1 - descGeneralPct / 100)

  if (precioMinimo != null) {
    return efectivo >= precioMinimo
  }

  // Floor unknown — fail-open for UX (server is authoritative at submit time).
  // The cart/modal UX is purely advisory; an unknown floor must NOT alarm or block.
  // The server routes/rejects at submit (REQ-BANDS-03 null-floor = fail-open policy).
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// computeModalFloor — raised floor for the per-item discount modal
// ─────────────────────────────────────────────────────────────────────────────

export interface ComputeModalFloorInput {
  /**
   * Server-computed profitability floor (PrecioMinimoRentable).
   * The SINGLE floor for ALL roles (PR-2d/2e-a unification, REQ-BANDS-03).
   * When null/undefined the floor is unknown — caller receives floorUnknown=true.
   */
  precioMinimo: number | null | undefined
  /**
   * Current general (sale-level) discount percentage (0–100).
   * When > 0 the per-item floor is raised so that the compound result
   * (item % × general %) stays above the raw server floor.
   * Defaults to 0 (no general discount active).
   */
  descuentoGeneral?: number
}

export interface ComputeModalFloorResult {
  /**
   * The effective floor to validate the item price against.
   * Rounded to 2 decimal places (mirrors web computeModalFloor rounding).
   * 0 when floorUnknown.
   */
  piso: number
  /**
   * True when precioMinimo is null/undefined.
   * Null-floor policy (REQ-BANDS-03): fail-OPEN — unknown floor must NOT block
   * or warn. Mirrors web DescuentoItemModal + derivarFloorBroken behaviour.
   */
  floorUnknown: boolean
}

/**
 * Computes the per-item discount floor for the modal, factoring in the current
 * general discount (mirrors web `computeModalFloor` in modal-discount-helpers.ts).
 *
 * Raised floor formula:
 *   effectiveFloor = precioMinimo / (1 - descuentoGeneral/100)
 * where generalFactor = Math.max(1 - descuentoGeneral/100, 0.0001) to prevent
 * div/0 at g=100.
 *
 * The returned `piso` is rounded to 2 decimal places — matches web rounding so
 * that displayed and compared floors are identical (W2 parity).
 *
 * ROUNDING (W2): Both the displayed minimum label and the piercesFloor comparison
 * use this rounded value. Mirrors web: `Math.round(effectiveFloor * 100) / 100`.
 */
export function computeModalFloor(input: ComputeModalFloorInput): ComputeModalFloorResult {
  const { precioMinimo, descuentoGeneral = 0 } = input

  if (precioMinimo == null) {
    return { piso: 0, floorUnknown: true }
  }

  // Clamp to avoid div/0 when descuentoGeneral === 100
  const generalFactor = Math.max(1 - descuentoGeneral / 100, 0.0001)
  const effectiveFloor = precioMinimo / generalFactor

  return {
    piso: Math.round(effectiveFloor * 100) / 100,
    floorUnknown: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// derivarFloorBroken — RED-cart per-line derivation helper
// ─────────────────────────────────────────────────────────────────────────────

export interface DerivarFloorBrokenInput extends EsDescuentoValidoCompuestoInput {}

/**
 * Derives whether a cart line's effective price breaks the profitability floor.
 *
 * Returns true when the compound effective price pierces the single server floor
 * (line should render RED). This includes a directly-typed below-floor base price
 * (the P.U. field is editable), so there is NO 0-discount early-return.
 *
 * Floor-unknown policy (REQ-BANDS-03, unified): when `precioMinimo` is null/undefined
 * the floor is UNKNOWN and the line is NOT flagged (fail-OPEN — no red border). The cart
 * is UX-only and the server is authoritative at submit (it routes/rejects). This agrees
 * with CarritoSemaforo, which renders a neutral indicator on an unknown floor, so a
 * no-cost product never shows a contradictory red-border-plus-neutral-semáforo signal.
 *
 * This is the UX live-warning helper: it does NOT block form submission — the server
 * and submit-time validation remain authoritative. Use this only for visual feedback.
 */
export function derivarFloorBroken(input: DerivarFloorBrokenInput): boolean {
  // Floor unknown → fail-OPEN: do not flag (server authoritative at submit).
  if (input.precioMinimo == null) return false

  return !esDescuentoValidoCompuesto(input)
}
