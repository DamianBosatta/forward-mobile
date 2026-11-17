import {
  aDecimal,
  aNumero,
  dividirPorCien,
  multiplicarDecimales,
  redondearDecimal,
  restarDecimales,
  sumarDecimales,
} from '@/libs/reglas'

/**
 * Total de la venta tal como lo arma el servidor al grabar (RED-06, decisión del dueño #33).
 *
 * Copia de la web (`forward-frontend/apps/web/src/features/ventas/core/domain/total-venta.ts`, PR #1168),
 * que espeja `Venta.RecalcularTotales` y `VentaDetalle` (C#, `decimal`):
 *   unitario  = redondear(precio × (1 − desc línea / 100))
 *   renglón   = redondear(unitario × cantidad)
 *   subtotal  = Σ renglones
 *   descuento = subtotal × pct general / 100          (sin redondear para el total)
 *   total     = redondear(subtotal − descuento + flete)
 * con `redondear` = medio hacia afuera del cero. Es la ÚNICA regla de total de venta de la app: el
 * `totalEsperado` se compara por igualdad con el servidor (409 `TotalCambiado`), así que redondear
 * en `float` o redondear antes el descuento general hace volver ventas válidas.
 *
 * El unitario (`conDescuento`), el renglón (`multiplicarYRedondear`) y la suma (`sumarMontos`) viven
 * en `libs/reglas/dinero`; `totalVenta.test.ts` repite los casos de la web.
 */

export interface TotalesVenta {
  /** `MontoDescuento` del servidor: el descuento general redondeado. */
  montoDescuento: number
  /** `Total` del servidor: lo que la venta graba y lo que se manda como `totalEsperado`. */
  total: number
}

export function calcularTotalesVenta(params: {
  subtotalBruto: number
  descuentoGeneralPct: number
  cargoFlete: number
}): TotalesVenta {
  if (!Object.values(params).every(Number.isFinite)) {
    return { montoDescuento: Number.NaN, total: Number.NaN }
  }
  const subtotal = aDecimal(params.subtotalBruto)
  const descuento = dividirPorCien(multiplicarDecimales(subtotal, aDecimal(params.descuentoGeneralPct)))
  const total = sumarDecimales(restarDecimales(subtotal, descuento), aDecimal(params.cargoFlete))
  return {
    montoDescuento: aNumero(redondearDecimal(descuento)),
    total: aNumero(redondearDecimal(total)),
  }
}
