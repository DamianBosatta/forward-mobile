import type { RangoDeDias } from '@/features/cuentas/lib/periodo'

/** Chips de la lista: pagos a proveedores, cobros de clientes o los dos. */
export type FiltroDePagos = 'proveedor' | 'cliente' | 'todos'

export const FILTROS_DE_PAGOS: { value: FiltroDePagos; label: string }[] = [
  { value: 'proveedor', label: 'Pagos' },
  { value: 'cliente', label: 'Cobros' },
  { value: 'todos', label: 'Todos' },
]

export const TAMANO_DE_PAGINA = 20

/**
 * `GET /Tesoreria?fuente=pago` (el historial de la web, `pagos-client.tsx`), con la categoría del chip, la búsqueda y
 * el período en el servidor. "Todos" no manda categoría.
 */
export function urlDePagos(filtro: FiltroDePagos, pagina: number, busqueda = '', rango?: RangoDeDias): string {
  const sp = ['fuente=pago']
  if (filtro !== 'todos') sp.push(`categoria=${filtro}`)
  sp.push(`pageNumber=${pagina}`, `pageSize=${TAMANO_DE_PAGINA}`)
  const texto = busqueda.trim()
  if (texto) sp.push(`searchTerm=${encodeURIComponent(texto)}`)
  if (rango) sp.push(`fechaDesde=${rango.desde}`, `fechaHasta=${rango.hasta}`)
  return `/api/v1/Tesoreria?${sp.join('&')}`
}

export type SentidoDelPago = 'entra' | 'sale' | 'neutro'

/**
 * Como la web: `factor` 1 entra, -1 sale; 0 (pago por cuenta de terceros) o sin movimiento de caja no es ni
 * ingreso ni egreso (sin esto se pintaba como salida).
 */
export function sentidoDelPago(p: { factor: number; sinMovimientoDeCaja: boolean }): SentidoDelPago {
  if (p.factor === 0 || p.sinMovimientoDeCaja) return 'neutro'
  return p.factor === 1 ? 'entra' : 'sale'
}

export const NOMBRE_DEL_SENTIDO: Record<SentidoDelPago, string> = { entra: 'Entra', sale: 'Sale', neutro: 'Sin movimiento de caja' }

/** Lista vacía, según el chip y si hay filtros puestos. */
export function textoSinPagos(filtro: FiltroDePagos, conFiltros: boolean): string {
  if (conFiltros) return 'Ningún pago coincide con la búsqueda.'
  if (filtro === 'proveedor') return 'No hay pagos a proveedores.'
  if (filtro === 'cliente') return 'No hay cobros de clientes.'
  return 'No hay pagos ni cobros registrados.'
}
