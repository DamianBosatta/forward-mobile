import { formatImporte } from '@/core/ui/fw/formatImporte'
import type { BorradorVenta } from '@/libs/api-client/ventas'

export interface IdentidadBorrador {
  /** Lo que identifica al borrador: la dirección del cliente y, si no hay, su razón social. */
  titulo: string
  /** La razón social, en línea aparte, solo cuando el título es la dirección. */
  subtitulo: string | null
  /** El total formateado (`$ 15.250,50`), o null si el servidor no lo manda. */
  total: string | null
}

/**
 * El cliente se identifica por la dirección (como en las tarjetas de ventas); la razón social va debajo.
 * Un servidor anterior a forward-system #898 no manda dirección ni total: queda la razón social sola y
 * sin importe, como siempre. Un cliente sin dirección (null o vacía) también queda con la razón social.
 */
export function identidadDeBorrador(b: BorradorVenta): IdentidadBorrador {
  const direccion = b.clienteDireccion?.trim()
  const total = typeof b.totalAmount === 'number' ? formatImporte(b.totalAmount, { moneda: b.totalCurrency }) : null
  return direccion
    ? { titulo: direccion, subtitulo: b.clienteNombre, total }
    : { titulo: b.clienteNombre, subtitulo: null, total }
}
