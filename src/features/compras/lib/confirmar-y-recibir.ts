import { api } from '@/libs/api-client/client'
import { mensajeDelServidor } from './mensaje-error'

/** Código del 409 que da el servidor cuando la compra ya estaba recibida (reintento seguro). */
const CODIGO_YA_RECIBIDA = 'CompraYaRecibida'

export interface DatosConfirmarYRecibir {
  /** `version` (xmin) del último guardado: si la compra cambió desde entonces, el servidor da 409. */
  version?: number
  /** yyyy-MM-dd; obligatoria si la condición de pago es por días desde la factura (si falta, 400). */
  fechaFacturaProveedor?: string
}

/**
 * Cómo terminó el intento: `hecho` va al detalle con el aviso (también cuando no se sabe, para que
 * el usuario lo revise ahí); `error` se queda en la pantalla con el motivo del servidor.
 */
export type Desenlace =
  | { tipo: 'hecho'; aviso: string; tono: 'exito' | 'advertencia' }
  | { tipo: 'error'; mensaje: string; recargar: boolean }

/**
 * POST /Compras/{id}/confirmar-y-recibir (forward-system #877): confirma y recibe una nota de pedido
 * en una sola transacción. El servidor decide todo; acá solo se traduce la respuesta.
 */
export async function confirmarYRecibir(id: string, datos: DatosConfirmarYRecibir): Promise<Desenlace> {
  try {
    const { sobre } = await api.postConSobre<string, { message?: string }>(`/api/v1/Compras/${id}/confirmar-y-recibir`, {
      version: datos.version ?? null,
      fechaFacturaProveedor: datos.fechaFacturaProveedor ?? null,
    })
    return { tipo: 'hecho', aviso: sobre?.message?.trim() || 'La compra quedó confirmada y recibida.', tono: 'exito' }
  } catch (e) {
    const { status, codigo } = (e ?? {}) as { status?: number; codigo?: string }
    if (status === 409 && codigo === CODIGO_YA_RECIBIDA) return { tipo: 'hecho', aviso: 'La compra ya quedó recibida.', tono: 'exito' }
    // Sin respuesta (timeout, red) o con falla del servidor no se sabe si llegó a recibirse.
    if (status === undefined || status >= 500) {
      return { tipo: 'hecho', aviso: 'No sabemos si se recibió; revisá la compra.', tono: 'advertencia' }
    }
    return { tipo: 'error', mensaje: mensajeDelServidor(e, 'No se recibió la compra.'), recargar: status === 409 }
  }
}
