import { crearBuzonDeAvisos } from '@/core/navigation/buzonDeAvisos'

/**
 * SEG-11: el texto que muestra la lámina "Venta guardada" queda en memoria, dejado por la venta que se guardó de
 * verdad. La ruta solo lleva una clave de un solo uso, así un enlace `forward://ventas/guardada?mensaje=…` no muestra
 * texto armado afuera.
 */
const buzon = crearBuzonDeAvisos<{ clave: string; texto: string }>()
let secuencia = 0

/** Deja el mensaje para la venta `id` y devuelve la clave que lleva la ruta. */
export function dejarMensajeDeVenta(id: string, texto: string): string {
  secuencia += 1
  const clave = `g${secuencia}`
  buzon.dejar(id, { clave, texto })
  return clave
}

/** El mensaje que dejó la venta `id` con esa clave (se consume al leerlo), o `undefined`. */
export function tomarMensajeDeVenta(id: string | undefined, clave: string | undefined): string | undefined {
  if (!id) return undefined
  return buzon.tomar(id, clave)?.texto
}
