/** Parada de solo cobro de la hoja de ruta (S9/S10): los tipos salen del contrato. */
import type { components } from '@/libs/api-client/generated/schema'

/** Las respuestas traen el estado como número: 1 Pendiente, 2 Cobrada, 3 NoCobrada. */
export const PARADA_COBRO_PENDIENTE = 1
export const PARADA_COBRO_COBRADA = 2
export const PARADA_COBRO_NO_COBRADA = 3

/** Por qué no se cobró. El comando lo recibe como texto; la respuesta lo devuelve como número (`numero`). */
export type MotivoNoCobro = components['schemas']['MotivoNoCobro']
export const MOTIVOS_NO_COBRO: ReadonlyArray<{ valor: MotivoNoCobro; numero: number; texto: string }> = [
  { valor: 'YaPago', numero: 1, texto: 'Ya pagó' },
  { valor: 'NoPago', numero: 2, texto: 'No pagó' },
  { valor: 'EstabaCerrado', numero: 3, texto: 'Estaba cerrado' },
]

export type ParadaCobro = components['schemas']['ParadaCobroDto']

/** Una línea de cobro: la misma `LineaCobroEntregaInput` de la entrega (el contrato las comparte). */
export type LineaCobroParada = components['schemas']['LineaCobroEntregaInput']

/** `POST hojas-ruta/{id}/paradas-cobro/{paradaCobroId}/cobrar` (sin la hora: la agrega el envío). */
export interface CuerpoCobroParada {
  claveIdempotencia: string
  lineas: LineaCobroParada[]
}

/** `POST …/paradas-cobro/{paradaCobroId}/no-cobrada` (sin la hora: la agrega el envío). */
export interface CuerpoNoCobroParada {
  motivo: MotivoNoCobro
}

/**
 * Las paradas de solo cobro de una hoja de ruta. Una hoja vieja (sin el campo) devuelve `undefined`: la consola se ve
 * y anda como antes. Sin casts en la pantalla: el contrato se lee acá.
 */
export function paradasCobroDe(hoja: unknown): ParadaCobro[] | undefined {
  const lista = (hoja as { paradasCobro?: unknown } | null | undefined)?.paradasCobro
  if (!Array.isArray(lista)) return undefined
  return (lista as ParadaCobro[]).filter((p) => typeof p?.id === 'string').sort((a, b) => a.orden - b.orden)
}
