import { resolverEstadoVenta } from '@/libs/reglas/estados'

export const PASOS_DE_LA_VENTA = ['Confirmado', 'Preparando', 'Empacado', 'En ruta', 'Entregado'] as const

export interface PasoDeLaVenta {
  etiqueta: (typeof PASOS_DE_LA_VENTA)[number]
  avance: 'completo' | 'medio' | 'vacio'
  actual: boolean
}

const INDICE: Record<string, { paso: number; medio?: boolean }> = {
  Confirmada: { paso: 0 },
  EnPreparacion: { paso: 1, medio: true },
  Empacada: { paso: 2 },
  EnRuta: { paso: 3 },
  Entregada: { paso: 4 },
}

/**
 * Los cinco pasos de la lámina ResVentaDetalle con su avance, o null si el estado no está en el camino
 * (pendiente, por autorizar, anulada, rechazada, vencida, no entregada).
 */
export function pasosDeLaVenta(estado: string | number | null | undefined): PasoDeLaVenta[] | null {
  const nombre = resolverEstadoVenta(estado)?.nombre
  const e = nombre ? INDICE[nombre] : undefined
  if (!e) return null
  return PASOS_DE_LA_VENTA.map((etiqueta, i) => ({
    etiqueta,
    avance: i < e.paso ? 'completo' : i === e.paso ? (e.medio ? 'medio' : 'completo') : 'vacio',
    actual: i === e.paso,
  }))
}
