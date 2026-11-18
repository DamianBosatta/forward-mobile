import { esFallaDeRed } from '@/core/api/errores'

/**
 * Tope de fallos de red seguidos de una acción guardada sin señal (consola del chofer y ventas sin señal).
 * Al llegar, la acción deja de reintentarse sola y queda para revisar con un aviso: no traba la cola y el usuario
 * decide (Reintentar con la misma clave, o Descartar). Con la espera de `esperaDeReintento` (15 s, duplicando hasta
 * 10 min) son unos 25 minutos con señal sin que el pedido llegue. Valor provisorio: el dueño no fijó uno.
 */
/** Se cuentan todos los fallos transitorios, pero solo detiene uno que `detieneEnElTope`. */
export const TOPE_DE_INTENTOS = 8

/** El aviso que queda en la acción detenida por el tope. */
export const avisoDeTope = (siguiente: string) =>
  `No salió después de ${TOPE_DE_INTENTOS} intentos y dejó de reintentarse sola. ${siguiente}`

/**
 * ¿Este fallo puede detener la acción por el tope? Sin red (el pedido no salió) o con la sesión vencida (401) no: nada
 * de la cola llega, así que detenerla no destraba a las de atrás y solo le saca el envío automático al volver la señal.
 * Sí cuentan los que llegaron al servidor o se colgaron en el camino (timeout, 5xx, 408, 429).
 */
export function detieneEnElTope(e: unknown): boolean {
  return !esFallaDeRed(e) && (e as { status?: unknown } | null)?.status !== 401
}
