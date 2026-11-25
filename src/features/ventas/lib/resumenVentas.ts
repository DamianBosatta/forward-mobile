import { formatImporte } from '@/core/ui/fw/formatImporte'
import { textoContador } from '@/features/listas/lib/contador'
import type { VentasResumen } from '@/libs/api-client/ventas'

/** TipoOperacionVenta del servidor: 1 = Presupuesto, 2 = Pedido. */
const PEDIDO = 2

/**
 * El resumen aplica los mismos filtros que la lista solo desde forward-system #873, que sumó
 * `cantidad`. Sin ella el servidor ignoró tipo y estados (y la lista también ignoró `estados`).
 */
export function resumenFiltrado(r: VentasResumen | undefined): r is VentasResumen & { cantidad: number } {
  return typeof r?.cantidad === 'number'
}

/**
 * "Mostrando N de M". N y M son de la lista (el servidor garantiza que su `totalCount` es la
 * `cantidad` del resumen con los mismos filtros); sin lista cargada no hay contador. Sin importe: el total
 * del filtro ya está en la tarjeta de arriba y repetido al lado de "N de M" parece la suma de las N.
 */
export function contadorVentas(cargados: number, totalLista: number | undefined): string | null {
  return textoContador(cargados, totalLista)
}

export interface TotalesDeLaLista {
  rotulo: string
  importe: string
  /** Cuántas del filtro esperan autorización (0 si el servidor no lo manda). */
  porAutorizar: number
}

/**
 * Tarjeta de totales de la lista (mockup ventas-lista): lo vendido (o presupuestado) del filtro, sin anuladas
 * ni rechazadas, y cuántas esperan autorización. Sin resumen filtrado (servidor anterior a #873) no hay tarjeta.
 */
export function totalesDeLaLista(r: VentasResumen | undefined, tipoOperacion: number): TotalesDeLaLista | null {
  if (!resumenFiltrado(r)) return null
  const esPedido = tipoOperacion === PEDIDO
  const total = esPedido ? r.totalVendido : r.totalPresupuestado
  if (typeof total !== 'number') return null
  return {
    rotulo: esPedido ? 'Vendido sin IVA · sin anuladas' : 'Presupuestado sin IVA · sin anuladas',
    importe: formatImporte(total),
    porAutorizar: typeof r.porAutorizar === 'number' ? r.porAutorizar : 0,
  }
}
