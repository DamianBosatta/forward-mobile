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

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * "entrega el jueves 22/10": el día guardado en la venta ("YYYY-MM-DD"), tomado tal cual (como `cabeceraDesdeVenta`)
 * para que ninguna zona horaria lo corra. Sin fecha (retiro en el local), null.
 */
export function entregaTexto(fechaEntrega: string | null | undefined): string | null {
  const dia = fechaEntrega?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dia) return null
  const semana = new Date(Date.UTC(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3]))).getUTCDay()
  return `entrega el ${DIAS[semana]} ${dia[3]}/${dia[2]}`
}

/** "3 productos · 34 unidades". */
export function resumenDeLineas(lineas: { cantidad: number }[]): string {
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0)
  return `${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'} · ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`
}
