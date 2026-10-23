import {
  resolverEstadoHojaRuta,
  resolverEstadoVenta,
  type EstadoCompraNombre,
  type EstadoHojaRutaNombre,
  type EstadoVentaNombre,
} from '@/libs/reglas/estados'

export type { EstadoCompraNombre, EstadoHojaRutaNombre, EstadoVentaNombre }

/**
 * Comparaciones de estado (C-016, L-33): la tabla es la de `libs/reglas/estados` (copia de la web).
 * El backend manda el estado como nombre, número o número en texto según el endpoint; acá se
 * resuelve una sola vez. Un estado que la tabla no conoce no es ninguno de los pedidos.
 */
export function esEstadoVenta(
  estado: string | number | null | undefined,
  ...nombres: EstadoVentaNombre[]
): boolean {
  const r = resolverEstadoVenta(estado)
  return r !== undefined && nombres.includes(r.nombre)
}

export function esEstadoHojaRuta(
  estado: string | number | null | undefined,
  ...nombres: EstadoHojaRutaNombre[]
): boolean {
  const r = resolverEstadoHojaRuta(estado)
  return r !== undefined && nombres.includes(r.nombre)
}

/** La compra siempre llega por nombre (`EstadoCompra` es string en el contrato). */
export function esEstadoCompra(
  estado: string | null | undefined,
  ...nombres: EstadoCompraNombre[]
): boolean {
  return estado != null && (nombres as string[]).includes(estado)
}
