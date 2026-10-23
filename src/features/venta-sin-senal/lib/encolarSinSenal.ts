import { esFallaDeRed } from '@/core/api/errores'
import { encolarVenta, type DatosParaEncolar, type VentaEnCola } from './cola'

/**
 * El alta de la venta falló: si fue por falta de conexión (el pedido no llegó, o llegó y no hubo respuesta) la venta
 * queda en el teléfono (V9) con la clave de su alta y el total que vio el vendedor, y se manda sola cuando vuelva la
 * señal con esa misma clave. Un error del servidor (400, 5xx) NO se encola: lo tiene que ver el vendedor en la venta.
 * Devuelve la venta encolada, o null si no corresponde (el llamador sigue con el error de siempre).
 * La misma clave dos veces queda una sola vez: volver a tocar Confirmar no duplica nada.
 */
export function encolarSiFaltaSenal(usuarioId: string | undefined, error: unknown, d: Omit<DatosParaEncolar, 'yaSeIntento'>): VentaEnCola | null {
  if (!usuarioId || !esFallaDeRed(error)) return null
  return encolarVenta(usuarioId, { ...d, yaSeIntento: true })
}
