import type { AjusteDeLinea } from '@/libs/api-client/autorizar-venta'

export interface LineaEditable {
  id: string
  productoNombre: string
  cantidad: number
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
