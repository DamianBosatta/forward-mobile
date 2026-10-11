import { formatImporte } from '@/core/ui/fw/formatImporte'
import { textoContador } from '@/features/listas/lib/contador'
import type { EstadoVentaServidor, VentasResumen } from '@/libs/api-client/ventas'

/** TipoOperacionVenta del servidor: 2 = Pedido. */
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
 * Importe del filtro para el contador. `totalVendido` suma solo pedidos sin anuladas ni rechazadas:
 * en presupuestos o mirando solo anuladas daría $ 0 al lado de ventas con importe, así que no se
 * muestra (el servidor no da otro importe para esos casos).
 */
function importeDelFiltro(r: VentasResumen | undefined, tipoOperacion: number, estados: readonly string[]): string | null {
  if (!resumenFiltrado(r) || tipoOperacion !== PEDIDO || typeof r.totalVendido !== 'number') return null
  if (estados.length > 0 && estados.every((e) => SIN_IMPORTE.includes(e as EstadoVentaServidor))) return null
  return formatImporte(r.totalVendido)
}

/**
 * "Mostrando N de M · $ X": M e importe del resumen (mismos filtros que la lista). Con el servidor
 * anterior a #873, M es el `totalCount` de la lista y no hay importe.
 */
export function contadorVentas(
  cargados: number,
  totalLista: number | undefined,
  r: VentasResumen | undefined,
  filtro: { tipoOperacion: number; estados: readonly string[] },
): string | null {
  const total = resumenFiltrado(r) ? r.cantidad : totalLista
  return textoContador(cargados, total, importeDelFiltro(r, filtro.tipoOperacion, filtro.estados))
}
