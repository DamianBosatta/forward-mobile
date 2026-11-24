import type { Venta } from '@/libs/api-client/types'

/**
 * Cómo se nombra al cliente de una venta en una fila (regla del dueño): la dirección de entrega es el título y el
 * nombre (fantasía o, si no hay, razón social) va en una línea aparte. `displayNameCliente` no sirve de nombre:
 * el servidor lo arma con la dirección. Sin dirección, el nombre pasa a ser el título.
 */
export function clienteDeVenta(v: Pick<Venta, 'direccionCliente' | 'nombreFantasiaCliente' | 'razonSocialCliente' | 'displayNameCliente'>): { titulo: string; nombre: string | null } {
  const direccion = v.direccionCliente?.trim()
  const nombre = v.nombreFantasiaCliente?.trim() || v.razonSocialCliente?.trim() || null
  if (direccion) return { titulo: direccion, nombre: nombre && nombre !== direccion ? nombre : null }
  return { titulo: nombre ?? v.displayNameCliente, nombre: null }
}
