import { esFallaDeRed } from '@/core/api/errores'

/**
 * Tope de fallos seguidos de una acción guardada sin señal (consola del chofer y ventas sin señal) que llegaron al
 * servidor o se colgaron en el camino (`detieneEnElTope`). Al llegar, la acción deja de reintentarse sola y queda para
 * revisar con un aviso: no traba la cola y el usuario decide (Reintentar con la misma clave, o Descartar). Con la
 * espera de `esperaDeReintento` (15 s, duplicando hasta 10 min) son unos 25 minutos con señal sin que el pedido
 * llegue. Los fallos sin red o con la sesión vencida no suman. Valor provisorio: el dueño no fijó uno.
 */
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

/**
 * La cuenta del tope después de este fallo transitorio: suma uno solo si `detieneEnElTope`. Va en su propio campo
 * (`fallosDelTope`), aparte de `intentos`, que sigue contando todos los fallos como antes: una cola guardada por una
 * versión anterior trae `intentos` altos por los fallos sin red y no tiene este campo, así que arranca de cero en vez de
 * detenerse en su primer 5xx, y la versión anterior lee la cola nueva sin problema. Un valor ilegible cuenta como cero.
 */
export function fallosDelTopeTras(previos: unknown, e: unknown): number {
  const antes = typeof previos === 'number' && Number.isFinite(previos) && previos > 0 ? previos : 0
  return antes + (detieneEnElTope(e) ? 1 : 0)
}
