import type { FormFactor } from '@/libs/useResponsive'
import { space } from '@/libs/theme'

/** Ancho mínimo de una tarjeta del catálogo: foto de 76, nombre que parte por palabras, "Agregar" en un renglón y − cantidad +. */
export const ANCHO_MINIMO_TARJETA = 280

/**
 * Columnas del catálogo de venta según el ancho real de la grilla (después del menú fijo y del panel de la venta).
 * Teléfono: 1. Tablet vertical: 2. Tablet horizontal: las que entran con ANCHO_MINIMO_TARJETA, entre 1 y 3.
 * `anchoDisponible` es el de la lista ya medida (sin medir todavía: el criterio por formato).
 */
export function columnasDelCatalogo(formFactor: FormFactor, anchoDisponible: number | null): number {
  if (formFactor === 'phone') return 1
  if (formFactor === 'tabletPortrait') return 2
  if (anchoDisponible == null || anchoDisponible <= 0) return 3
  const utilizable = anchoDisponible - space[4] * 2
  const entran = Math.floor((utilizable + space[3]) / (ANCHO_MINIMO_TARJETA + space[3]))
  return Math.min(3, Math.max(1, entran))
}
