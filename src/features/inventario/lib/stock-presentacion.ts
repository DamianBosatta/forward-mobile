import type { ChipInfo } from '@/core/ui/fw'

/** Lo que la pantalla de stock necesita de cada renglón del servidor (GET /Stocks). */
export interface FilaDeStock {
  cantidadDisponible: number
  cantidadReservada: number
  cantidadVirtual: number
  stockMinimo: number
  enAlerta: boolean
}

/**
 * Chip del renglón con cantidades: "Sin stock" si no queda disponible, "En alerta" si el servidor lo marca así
 * (disponible <= mínimo; la web usa el mismo `enAlerta`, no se recalcula acá) y "Hay stock" con stock de sobra.
 */
export function chipDeFilaStock(f: Pick<FilaDeStock, 'cantidadDisponible' | 'enAlerta'>): ChipInfo | null {
  if (f.cantidadDisponible <= 0) return { estado: 'anulado', label: 'Sin stock' }
  if (f.enAlerta) return { estado: 'porAutorizar', label: 'En alerta' }
  return { estado: 'entregado', label: 'Hay stock' }
}

/** "Mín. 24" o nada si el producto no tiene mínimo. */
export function textoMinimo(stockMinimo: number): string | null {
  return stockMinimo > 0 ? `Mín. ${stockMinimo}` : null
}

/** "Reservado 96 · Por ingresar 0": las dos cantidades van siempre, aunque sean 0 (lámina Stock). */
export function textoReservadas(reservadas: number, porIngresar: number): string {
  return `Reservado ${reservadas} · Por ingresar ${porIngresar}`
}

export type FiltroEstadoStock = 'todos' | 'EnAlerta' | 'SinStock'
