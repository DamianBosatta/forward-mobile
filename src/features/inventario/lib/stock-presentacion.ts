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
 * Chip del renglón con cantidades: "Sin stock" si no queda disponible, "Poco stock" si el servidor lo marca en alerta
 * (disponible <= mínimo; la web usa el mismo `enAlerta`, no se recalcula acá). Con stock de sobra, sin chip.
 */
export function chipDeFilaStock(f: Pick<FilaDeStock, 'cantidadDisponible' | 'enAlerta'>): ChipInfo | null {
  if (f.cantidadDisponible <= 0) return { estado: 'anulado', label: 'Sin stock' }
  if (f.enAlerta) return { estado: 'pendiente', label: 'Poco stock' }
  return null
}

/** "mínimo 24" o nada si el producto no tiene mínimo. */
export function textoMinimo(stockMinimo: number): string | null {
  return stockMinimo > 0 ? `mínimo ${stockMinimo}` : null
}

/** "6 reservadas" / "1 reservada" / "sin reservas"; "+40 por ingresar" se agrega aparte. */
export function textoReservadas(reservadas: number): string {
  if (reservadas <= 0) return 'sin reservas'
  return reservadas === 1 ? '1 reservada' : `${reservadas} reservadas`
}

export type FiltroEstadoStock = 'todos' | 'EnAlerta' | 'SinStock'
