import type { AjusteDeLinea } from '@/libs/api-client/autorizar-venta'
import { calcularSubtotalConDescuento } from '@/features/ventas/lib/descuentos'
import { redondear2 } from '@/libs/reglas/dinero'

export interface LineaEditable {
  id: string
  productoNombre: string
  cantidad: number
  precioUnitario?: number
  subtotal?: number
}

export interface TotalesDeVenta {
  subtotalBrutoAmount: number
  porcentajeDescuento?: number | null
  montoDescuentoAmount: number
  cargoFleteAmount?: number | null
  totalAmount: number
}

export interface TotalesEstimados {
  /** Subtotal por línea (id del detalle) con la cantidad nueva; solo las líneas con cambio. */
  subtotalDeLinea: Record<string, number>
  subtotalBruto: number
  montoDescuento: number
  flete: number
  /** null mientras haya una cantidad inválida: no hay total que mostrar como si fuera definitivo. */
  total: number | null
  /** Hay cambios o cantidades inválidas: el total ya no es el que guardó el servidor. */
  estimado: boolean
}

export interface CambioDeLinea {
  id: string
  nombre: string
  antes: number
  /** 0 = la línea se quita. */
  despues: number
}

export interface LecturaDeAjustes {
  ajustes: AjusteDeLinea[]
  cambios: CambioDeLinea[]
  /** Error por línea (id del detalle). */
  errores: Record<string, string>
  /** Motivo por el que no se puede autorizar con estas cantidades; null si se puede. */
  bloqueo: string | null
}

export const BLOQUEO_SIN_LINEAS = 'Quitaste todas las líneas. Si no se va a entregar nada, rechazá la venta en lugar de autorizarla.'
export const BLOQUEO_CON_ERRORES = 'Corregí las cantidades marcadas para poder autorizar.'

export function formatCantidad(n: number): string {
  return String(n).replace('.', ',')
}

/**
 * Lee lo que escribió el que autoriza en cada línea. Solo se puede bajar la cantidad o quitar la línea (0):
 * vacío o igual a la original = sin cambio. El servidor vuelve a validar (fracción de venta del producto,
 * líneas ajenas o repetidas) y su mensaje se muestra al confirmar. No hace cuentas de plata.
 */
export function leerAjustes(lineas: LineaEditable[], textos: Record<string, string>): LecturaDeAjustes {
  const ajustes: AjusteDeLinea[] = []
  const cambios: CambioDeLinea[] = []
  const errores: Record<string, string> = {}
  for (const l of lineas) {
    const limpio = (textos[l.id] ?? '').trim().replace(',', '.')
    if (limpio === '') continue
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(limpio)) { errores[l.id] = 'Escribí un número, por ejemplo 9 o 2,5.'; continue }
    const nueva = Number(limpio)
    if (nueva === l.cantidad) continue
    if (nueva > l.cantidad) { errores[l.id] = `Solo se puede bajar la cantidad (pedido: ${formatCantidad(l.cantidad)}).`; continue }
    ajustes.push({ ventaDetalleId: l.id, cantidadNueva: nueva })
    cambios.push({ id: l.id, nombre: l.productoNombre, antes: l.cantidad, despues: nueva })
  }
  const quitaTodo = lineas.length > 0 && cambios.filter((c) => c.despues === 0).length === lineas.length
  const bloqueo = Object.keys(errores).length > 0 ? BLOQUEO_CON_ERRORES : quitaTodo ? BLOQUEO_SIN_LINEAS : null
  return { ajustes, cambios, errores, bloqueo }
}

/**
 * Total de la venta con las cantidades que escribe quien autoriza, antes de confirmar. Espejo de
 * `Venta.RecalcularTotales` (el servidor es la autoridad y recalcula al confirmar): subtotal bruto = suma
 * de líneas, el descuento general vigente se aplica sobre ese subtotal y el flete se suma sin descontar.
 * La línea es unitario neto × cantidad con el redondeo de `calcularSubtotalConDescuento` (descuento 0). Sin cambios devuelve los números del servidor tal cual.
 */
export function estimarTotales(venta: TotalesDeVenta, lineas: LineaEditable[], lectura: LecturaDeAjustes): TotalesEstimados {
  const flete = venta.cargoFleteAmount ?? 0
  const hayErrores = Object.keys(lectura.errores).length > 0
  if (lectura.cambios.length === 0) {
    return {
      subtotalDeLinea: {}, subtotalBruto: venta.subtotalBrutoAmount, montoDescuento: venta.montoDescuentoAmount, flete,
      total: hayErrores ? null : venta.totalAmount, estimado: hayErrores,
    }
  }
  const nuevas = new Map(lectura.cambios.map((x) => [x.id, x.despues]))
  const subtotalDeLinea: Record<string, number> = {}
  let subtotalBruto = 0
  for (const l of lineas) {
    const nueva = nuevas.get(l.id)
    if (nueva === undefined) { subtotalBruto += l.subtotal ?? 0; continue }
    // El unitario del detalle ya es neto (incluye el descuento de la línea, `VentaDetalle.cs:170`): no se descuenta de nuevo.
    subtotalDeLinea[l.id] = calcularSubtotalConDescuento(l.precioUnitario ?? 0, nueva, 0)
    subtotalBruto += subtotalDeLinea[l.id]
  }
  subtotalBruto = redondear2(subtotalBruto)
  const descuento = subtotalBruto * ((venta.porcentajeDescuento ?? 0) / 100)
  return {
    subtotalDeLinea, subtotalBruto, montoDescuento: redondear2(descuento), flete,
    total: hayErrores ? null : redondear2(subtotalBruto - descuento + flete), estimado: true,
  }
}
