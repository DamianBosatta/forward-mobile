import { ApiError } from '@/core/api/client'
import type { CodigoError } from '@/libs/api-client/generated/codigos-error'

const FALLBACK_MESSAGE = 'No se pudo completar la operación.'

/**
 * Lo que escribe cada motor en el `TypeError` con el que `fetch` rechaza cuando el pedido no llega
 * al servidor. No hay un tipo ni un código que lo distinga: sólo el texto. React Native (okhttp /
 * NSURLSession) manda «Network request failed»; el resto cubre los tests (Node) y la web.
 */
const TEXTOS_DE_FALLA_DE_RED = [
  /^network request failed$/i, // React Native
  /^failed to fetch$/i, // Chrome, Edge
  /networkerror/i, // Firefox
  /load failed/i, // Safari
  /fetch failed/i, // Node (undici)
]

/**
 * True si `e` es el rechazo de `fetch` por un pedido que no llegó al servidor. Mira el texto además
 * del tipo a propósito: un `TypeError` también es lo que tira un bug de la pantalla («x is not a
 * function»), y presentarlo como "sin conexión" mandaría a revisar una red que anda bien.
 */
export function esFallaDeRed(e: unknown): boolean {
  return e instanceof TypeError && TEXTOS_DE_FALLA_DE_RED.some((texto) => texto.test(e.message))
}

/**
 * True si `e` es un {@link ApiError} con ese código del catálogo de errores. Es como una pantalla
 * decide qué hacer: por código, nunca leyendo el texto del mensaje.
 */
export function esError(e: unknown, codigo: CodigoError): e is ApiError {
  return e instanceof ApiError && e.codigo === codigo
}

/**
 * El único lugar que convierte lo que recibe un `catch` (`unknown`) en el texto para el usuario: el
 * mensaje del servidor y, debajo, el motivo por campo (en los errores de validación el mensaje es
 * genérico y el motivo real viene en `errors`).
 */
export function mensajeDeError(e: unknown, porDefecto: string = FALLBACK_MESSAGE): string {
  if (!(e instanceof Error)) return porDefecto
  const detalles = (e as Error & { errors?: unknown }).errors
  const lista = Array.isArray(detalles) ? detalles.filter((d): d is string => typeof d === 'string' && d.length > 0) : []
  const partes = [e.message, ...lista].filter((p) => p && p.trim().length > 0)
  return partes.length > 0 ? partes.join('\n') : porDefecto
}
