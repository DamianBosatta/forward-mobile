import type { VentaHeaderDto } from '@/libs/api-client/types'
import { direccionDeEntrega, nombreDelCliente, type ClienteNombrable } from '@/features/clientes/lib/cliente'

/** Número de la venta (A00001); un borrador sin número muestra el comienzo del id. */
export const codigoDeVenta = (h: Pick<VentaHeaderDto, 'codigoPedido' | 'id'>) => h.codigoPedido ?? h.id.slice(0, 8).toUpperCase()

export const tipoDeVenta = (h: Pick<VentaHeaderDto, 'tipoOperacion'>) => (h.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido')

/** "Dirección · nombre": el cliente se identifica por la dirección; el nombre va aparte. */
export function rotuloCliente(c: ClienteNombrable): string {
  const nombre = nombreDelCliente(c)
  return nombre ? `${direccionDeEntrega(c)} · ${nombre}` : direccionDeEntrega(c)
}
