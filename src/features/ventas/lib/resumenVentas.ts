import { formatImporte } from '@/core/ui/fw/formatImporte'
import { textoContador } from '@/features/listas/lib/contador'
import type { EstadoVentaServidor, VentasResumen } from '@/libs/api-client/ventas'

/** TipoOperacionVenta del servidor: 1 = Presupuesto, 2 = Pedido. */
const PRESUPUESTO = 1
const PEDIDO = 2
/** Estados que nunca son plata: `totalVendido` los deja afuera. */
const SIN_IMPORTE: readonly EstadoVentaServidor[] = ['Anulada', 'RechazadaAutorizacion']

/**
 * El resumen aplica los mismos filtros que la lista solo desde forward-system #873, que sumó
 * `cantidad`. Sin ella el servidor ignoró tipo y estados (y la lista también ignoró `estados`).
 */
export function resumenFiltrado(r: VentasResumen | undefined): r is VentasResumen & { cantidad: number } {
  return typeof r?.cantidad === 'number'
}

/**
 * Importe del filtro para el contador. `totalVendido` suma solo pedidos y `totalPresupuestado` solo
 * presupuestos, los dos sin anuladas ni rechazadas: mirando solo anuladas darían $ 0 al lado de ventas
 * con importe, así que no se muestran. Sin `totalPresupuestado` (servidor anterior a la prioridad 3
 * del bloque 9) los presupuestos van sin importe.
 */
function importeDelFiltro(r: VentasResumen | undefined, tipoOperacion: number, estados: readonly string[]): string | null {
  if (!resumenFiltrado(r)) return null
  const total = tipoOperacion === PEDIDO ? r.totalVendido : tipoOperacion === PRESUPUESTO ? r.totalPresupuestado : undefined
  if (typeof total !== 'number') return null
  if (estados.length > 0 && estados.every((e) => SIN_IMPORTE.includes(e as EstadoVentaServidor))) return null
  return formatImporte(total)
}

/**
 * "Mostrando N de M · $ X". N y M son de la lista (el servidor garantiza que su `totalCount` es la
 * `cantidad` del resumen con los mismos filtros); sin lista cargada no hay contador, aunque el
 * resumen haya llegado. El resumen solo pone el importe, y sin `cantidad` (servidor anterior a
 * #873) no lo pone.
 */
export function contadorVentas(
  cargados: number,
  totalLista: number | undefined,
  r: VentasResumen | undefined,
  filtro: { tipoOperacion: number; estados: readonly string[] },
): string | null {
  return textoContador(cargados, totalLista, importeDelFiltro(r, filtro.tipoOperacion, filtro.estados))
}
