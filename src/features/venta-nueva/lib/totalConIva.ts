import type { VistaPreviaVenta } from '@/libs/api-client/ventas'

/** Una fila del desglose: el IVA de una alícuota, tal cual lo calculó el servidor (se muestra `porcentaje`, nunca el enum). */
export interface IvaDeAlicuota { porcentaje: number; iva: number }

export interface DesgloseIva { neto: number; iva: number; total: number; porAlicuota: IvaDeAlicuota[] }

/**
 * Qué se sabe del total con IVA de una venta con factura (IVA encima del neto). Todo viene de la vista previa del
 * servidor: acá no hay fórmula de IVA. `sinSenal` distingue "no hay red" (la venta puede ir a la cola) de un fallo con red.
 */
export type TotalConIva =
  | { estado: 'sin' }
  | { estado: 'calculando' }
  | { estado: 'error'; sinSenal: boolean }
  | { estado: 'listo'; total: number | null; desglose: DesgloseIva | null }

/** Lo que identifica "la misma venta" para la vista previa: el cuerpo sin los campos que no cambian el total. */
export function firmaDeVistaPrevia(cuerpo: object | null): string {
  if (!cuerpo) return ''
  const { claveIdempotencia: _c, motivoVentaSinStock: _m, ...resto } = cuerpo as Record<string, unknown>
  return JSON.stringify(resto)
}

/** El desglose solo existe en el régimen nuevo (IVA > 0); sin IVA la venta se ve como siempre. */
export function desgloseDe(data: Partial<VistaPreviaVenta> | undefined): DesgloseIva | null {
  if (!data || typeof data.iva !== 'number' || data.iva <= 0 || typeof data.totalNeto !== 'number' || typeof data.total !== 'number') return null
  const filas = Array.isArray(data.ivaPorAlicuota) ? data.ivaPorAlicuota : []
  return { neto: data.totalNeto, iva: data.iva, total: data.total, porAlicuota: filas.map((f) => ({ porcentaje: f.porcentaje, iva: f.iva })) }
}
