import { api } from '@/libs/api-client/client'
import { conClave, crearIntento } from '@/core/utils/idempotencia'
import { mensajeDelServidor } from './mensaje-error'
import { numeroDeCompra } from './numero'
import { crearBuzonDeAvisos } from '@/core/navigation/buzonDeAvisos'

/** Una clave por intento: el reintento (red, doble toque) de la misma confirmación manda la misma clave. */
const intento = crearIntento()

/** Código del 409 que da el servidor cuando la compra ya estaba recibida (reintento seguro). */
const CODIGO_YA_RECIBIDA = 'CompraYaRecibida'

export interface DatosConfirmarYRecibir {
  /** `version` (xmin) del último guardado: si la compra cambió desde entonces, el servidor da 409. */
  version?: number
  /** yyyy-MM-dd; obligatoria si la condición de pago es por días desde la factura (si falta, 400). */
  fechaFacturaProveedor?: string
}

/** Clave del aviso que viaja en la ruta al detalle (`?aviso=`): el texto nunca va en la URL. */
export type ClaveAviso = 'recibida' | 'ya-recibida' | 'incierto' | 'faltante'
export interface Aviso { clave: ClaveAviso; texto: string; tono: 'exito' | 'advertencia' }

const TEXTOS: Record<ClaveAviso, string> = {
  recibida: 'La compra quedó confirmada y recibida.',
  'ya-recibida': 'La compra ya quedó recibida.',
  incierto: 'No sabemos si se recibió; revisá la compra.',
  faltante: 'Lo que faltó pasó a una compra nueva.',
}
const aviso = (clave: ClaveAviso, mensaje?: string): Aviso =>
  ({ clave, texto: (clave === 'recibida' && mensaje?.trim()) || TEXTOS[clave], tono: clave === 'incierto' ? 'advertencia' : 'exito' })

/** Recepción parcial (R22b): dice el número de la compra nueva con lo que faltó, como en el mensaje del servidor. */
export const avisoCompraFaltante = (numero: number): Aviso => ({
  clave: 'faltante', tono: 'exito',
  texto: `Lo que faltó pasó a la compra ${numeroDeCompra({ id: '', numero })}, confirmada y pendiente de recibir.`,
})

/** Avisos en memoria por compra, para el detalle que se abre después: un enlace con `?aviso=` solo no muestra nada. */
const buzon = crearBuzonDeAvisos<Aviso>()
export const dejarAviso = buzon.dejar
/** Devuelve (y consume) el aviso que se dejó para esta compra, solo si coincide con la clave de la ruta. */
export const tomarAviso = buzon.tomar

/**
 * Cómo terminó el intento: `hecho` va al detalle con el aviso (también cuando no se sabe, para que
 * el usuario lo revise ahí); `error` se queda en la pantalla con el motivo del servidor.
 */
export type Desenlace =
  | { tipo: 'hecho'; aviso: Aviso }
  | { tipo: 'error'; mensaje: string; recargar: boolean }

/**
 * POST /Compras/{id}/confirmar-y-recibir (forward-system #877): confirma y recibe una nota de pedido
 * en una sola transacción. El servidor decide todo; acá solo se traduce la respuesta.
 */
export async function confirmarYRecibir(id: string, datos: DatosConfirmarYRecibir): Promise<Desenlace> {
  try {
    const { sobre } = await conClave(
      intento,
      { version: datos.version ?? null, fechaFacturaProveedor: datos.fechaFacturaProveedor ?? null },
      (cuerpo) => api.postConSobre<string, { message?: string }>(`/api/v1/Compras/${id}/confirmar-y-recibir`, cuerpo),
      id,
    )
    return { tipo: 'hecho', aviso: aviso('recibida', sobre?.message) }
  } catch (e) {
    const { status, codigo } = (e ?? {}) as { status?: number; codigo?: string }
    if (status === 409 && codigo === CODIGO_YA_RECIBIDA) return { tipo: 'hecho', aviso: aviso('ya-recibida') }
    // Sin respuesta (timeout, red) o con falla del servidor no se sabe si llegó a recibirse.
    if (status === undefined || status >= 500) return { tipo: 'hecho', aviso: aviso('incierto') }
    return { tipo: 'error', mensaje: mensajeDelServidor(e, 'No se recibió la compra.'), recargar: status === 409 }
  }
}
