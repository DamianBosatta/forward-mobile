import type { MotivoAutorizacionDetalle } from '@/libs/api-client/types'

/**
 * Por qué una venta espera autorización. Espejo de `Domain.Enum.MotivoPendienteAutorizacion`
 * del servidor: es un [Flags], así que una venta puede esperar por más de un motivo a la vez
 * y se muestran todos. El orden es el de la lámina Autorizaciones.
 */
export type ClaveMotivo = 'descuento' | 'margen' | 'stock' | 'deuda' | 'credito' | 'cesion'

export interface Motivo {
  clave: ClaveMotivo
  /** Texto corto para el filtro. */
  filtro: string
  /** Frase para la tarjeta y el detalle. */
  texto: string
}

const MOTIVOS: (Motivo & { bit: number })[] = [
  { bit: 4, clave: 'descuento', filtro: 'Descuento', texto: 'Supera el tope de descuento del vendedor' },
  { bit: 2, clave: 'margen', filtro: 'Margen', texto: 'Hay líneas por debajo del precio mínimo rentable (margen en amarillo)' },
  { bit: 1, clave: 'stock', filtro: 'Sin stock', texto: 'Falta stock: el vendedor dejó el motivo en la venta' },
  { bit: 16, clave: 'deuda', filtro: 'Deuda vencida', texto: 'El cliente tiene deuda vencida de más de 30 días' },
  { bit: 32, clave: 'credito', filtro: 'Crédito', texto: 'Supera el tope de crédito del cliente' },
  { bit: 8, clave: 'cesion', filtro: 'Cesión', texto: 'El vendedor cede parte de su comisión' },
]

/** Los motivos que trae el número del servidor, en el orden de la lámina. */
export function motivosDe(flags: number | null | undefined): Motivo[] {
  const n = flags ?? 0
  return MOTIVOS.filter((m) => (n & m.bit) !== 0).map(({ bit: _bit, ...m }) => m)
}

/**
 * Las frases de por qué espera la venta. Con `detalleMotivos` (forward-system #907) son las del servidor, una por
 * motivo y por línea, ya con los montos y productos; sin él (servidor anterior, o quien no puede autorizar) son las
 * frases genéricas de cada bandera, todas las que trae el número.
 */
export function textosDeMotivos(
  flags: number | null | undefined,
  detalle?: MotivoAutorizacionDetalle[] | null,
): { clave: string; texto: string }[] {
  const delServidor = (detalle ?? []).filter((d) => d.texto?.trim())
  if (delServidor.length > 0) return delServidor.map((d, i) => ({ clave: `${d.motivo}:${i}`, texto: d.texto }))
  return motivosDe(flags).map(({ clave, texto }) => ({ clave, texto }))
}

/**
 * El servidor exige la razón al autorizar cuando hay margen en amarillo
 * (`AutorizarVentaCommandHandler`: ValidationException si falta). Para los otros motivos es opcional.
 */
export function pideRazon(flags: number | null | undefined): boolean {
  return ((flags ?? 0) & 2) !== 0
}

/** Filtros con su cantidad, solo los que tienen alguna venta. "Todas" va primero. */
export function filtrosConConteo(lista: { motivoPendienteAutorizacion: number }[]): { clave: ClaveMotivo | 'todas'; label: string; cantidad: number }[] {
  const conteo = MOTIVOS.map((m) => ({
    clave: m.clave,
    label: m.filtro,
    cantidad: lista.filter((v) => (v.motivoPendienteAutorizacion & m.bit) !== 0).length,
  })).filter((f) => f.cantidad > 0)
  return [{ clave: 'todas' as const, label: 'Todas', cantidad: lista.length }, ...conteo]
}

/** ¿La venta espera por este motivo? */
export function tieneMotivo(flags: number, clave: ClaveMotivo | 'todas'): boolean {
  if (clave === 'todas') return true
  const m = MOTIVOS.find((x) => x.clave === clave)
  return !!m && (flags & m.bit) !== 0
}
