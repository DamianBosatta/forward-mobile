import type { ChipInfo } from '@/core/ui/fw'

/** Hay stock / Sin stock, con el booleano que decide el servidor. Sin dato, sin chip: no se inventa. */
export function chipDeStock(puedeVenderse: boolean | null | undefined): ChipInfo | null {
  if (puedeVenderse == null) return null
  return puedeVenderse ? { estado: 'entregado', label: 'Hay stock' } : { estado: 'anulado', label: 'Sin stock' }
}

/** "Se vende por caja de N" cuando la venta mínima es más de una unidad. */
export function textoUnidadDeVenta(ventaMinimaUnidades: number | null | undefined): string {
  const n = ventaMinimaUnidades ?? 1
  return n > 1 ? `Se vende por caja de ${n}` : 'Se vende por unidad'
}

/** Porcentaje argentino con un decimal: 40,0 %. */
export function formatPorcentaje(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')} %`
}
