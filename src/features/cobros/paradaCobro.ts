/**
 * Parada de solo cobro de la hoja de ruta (S9/S10). El cliente generado todavía no trae `paradasCobro`: se tipa a mano
 * solo lo que la consola consume del contrato (rama backend `feat/calendario-parada-cobro`). Cuando se regenere el
 * cliente, estos tipos se reemplazan por los de `components['schemas']`.
 */

/** 1 Pendiente, 2 Cobrada, 3 NoCobrada. */
export type EstadoParadaCobro = 1 | 2 | 3
export const PARADA_COBRO_PENDIENTE: EstadoParadaCobro = 1
export const PARADA_COBRO_COBRADA: EstadoParadaCobro = 2
export const PARADA_COBRO_NO_COBRADA: EstadoParadaCobro = 3

/** Por qué no se cobró: Ya pagó = 1, No pagó = 2, Estaba cerrado = 3. */
export type MotivoNoCobro = 1 | 2 | 3
export const MOTIVOS_NO_COBRO: ReadonlyArray<{ valor: MotivoNoCobro; texto: string }> = [
  { valor: 1, texto: 'Ya pagó' },
  { valor: 2, texto: 'No pagó' },
  { valor: 3, texto: 'Estaba cerrado' },
]

export interface ParadaCobro {
  id: string
  clienteId: string
  clienteNombre: string
  direccion?: string | null
  telefono?: string | null
  latitud?: number | null
  longitud?: number | null
  orden: number
  estado: EstadoParadaCobro
  montoAcordado?: number | null
  deudaCliente: number
  motivoNoCobro?: MotivoNoCobro | null
  motivoNoCobroTexto?: string | null
  pagoId?: string | null
  montoCobrado?: number | null
  eventoCalendarioId?: string | null
}

/** Una línea de cobro: la misma forma que `LineaCobroEntregaInput` de la entrega. */
export interface LineaCobroParada {
  medioPagoId: string
  monto: number
  fotoUrl?: string
  cheques?: unknown[]
}

/** `POST hojas-ruta/{id}/paradas-cobro/{paradaCobroId}/cobrar` (sin la hora: la agrega el envío). */
export interface CuerpoCobroParada {
  claveIdempotencia: string
  lineas: LineaCobroParada[]
}

/** `POST …/paradas-cobro/{paradaCobroId}/no-cobrada`. */
export interface CuerpoNoCobroParada {
  motivo: MotivoNoCobro
}

export interface RespuestaCobroParada {
  paradaCobroId: string
  pagoId: string
  montoCobrado: number
  repetida: boolean
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
