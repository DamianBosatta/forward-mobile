/**
 * Pure ROI/margin helper for the inventario feature (mobile).
 *
 * Mirrors web ProductoForm.tsx pricing preview logic (D6 design).
 * Formula: grossProfit = price - cost; roiPercentage = grossProfit / cost * 100.
 * Note: this is ROI as markup-over-cost, NOT the `margenGanancia` field
 * (which is the Gross Margin / sell-side percentage used in price derivation).
 */

export interface ProductoRoi {
  /** Gross profit in currency units: precioVentaSugerido - costoUnitario */
  grossProfit: number
  /** ROI as markup-over-cost percentage: (grossProfit / costoUnitario) * 100 */
  roiPercentage: number
}

/**
 * Calculates gross profit and ROI % for a product price preview.
 *
 * @param precioVentaSugerido - Suggested sale price (≥ 0)
 * @param costoUnitario       - Unit cost (must be > 0 to produce a meaningful ROI)
 * @returns { grossProfit, roiPercentage } — both are 0 when cost ≤ 0
 */
export function calcularRoiProducto(
  precioVentaSugerido: number,
  costoUnitario: number,
): ProductoRoi {
  if (costoUnitario <= 0) {
    return { grossProfit: 0, roiPercentage: 0 }
  }
  const grossProfit = precioVentaSugerido - costoUnitario
  const roiPercentage = (grossProfit / costoUnitario) * 100
  return { grossProfit, roiPercentage }
}
