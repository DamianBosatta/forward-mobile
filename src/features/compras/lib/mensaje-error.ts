/**
 * Texto que ve el usuario cuando el servidor rechaza una operación de compras.
 * El servidor responde con un sobre `{ message, errors[] }`: en los errores de validación el
 * `message` es genérico y el motivo real viene en `errors`, así que se muestran los dos.
 */
export function mensajeDelServidor(e: unknown, porDefecto = 'No se pudo completar la operación.'): string {
  if (!(e instanceof Error)) return porDefecto
  const detalles = (e as Error & { errors?: unknown }).errors
  const lista = Array.isArray(detalles) ? detalles.filter((d): d is string => typeof d === 'string' && d.length > 0) : []
  const partes = [e.message, ...lista].filter(p => p && p.trim().length > 0)
  return partes.length > 0 ? partes.join('\n') : porDefecto
}
