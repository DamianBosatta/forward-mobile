import { Platform } from 'react-native'
import { EstadoParada, type ParadaDto } from '@/libs/api-client/types'

export interface ParadaNumerada {
  parada: ParadaDto
  /** Posición en el recorrido (1, 2, 3…), en el orden que manda el servidor. */
  numero: number
}

export interface ResumenRuta {
  total: number
  /** Paradas ya reportadas: entregadas o no entregadas. */
  hechas: number
  /** Solo las entregadas: es lo que dice "2 de 8 entregadas" (chofer-01-viaje). */
  entregadas: number
  proxima: ParadaNumerada | null
  despues: ParadaNumerada[]
  reportadas: ParadaNumerada[]
}

const reportada = (p: ParadaDto) => p.estado === EstadoParada.Entregado || p.estado === EstadoParada.NoEntregado

/** Arma la hoja de ruta del chofer: la próxima parada pendiente, las que siguen y las ya reportadas. */
export function resumenRuta(detalles: ParadaDto[]): ResumenRuta {
  const numeradas = [...detalles]
    .sort((a, b) => a.orden - b.orden)
    .map((parada, i) => ({ parada, numero: i + 1 }))
  const pendientes = numeradas.filter((n) => !reportada(n.parada))
  const reportadas = numeradas.filter((n) => reportada(n.parada))
  return {
    total: numeradas.length,
    hechas: reportadas.length,
    entregadas: reportadas.filter((n) => n.parada.estado === EstadoParada.Entregado).length,
    proxima: pendientes[0] ?? null,
    despues: pendientes.slice(1),
    reportadas,
  }
}

/** Abre el mapa del teléfono con el camino hasta la dirección de la parada. */
export function urlComoLlegar(direccion: string): string {
  const destino = encodeURIComponent(direccion.trim())
  return Platform.OS === 'ios'
    ? `maps://?daddr=${destino}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destino}`
}

/** `tel:` con solo los dígitos (y el + inicial); `null` si no hay un número para marcar. */
export function urlLlamar(telefono: string | null | undefined): string | null {
  const limpio = (telefono ?? '').trim().replace(/(?!^\+)[^\d]/g, '')
  return /\d{6,}/.test(limpio) ? `tel:${limpio}` : null
}

/** Motivos de la lámina ChoferNoEntrega. El servidor guarda el texto tal cual. */
export const MOTIVOS_NO_ENTREGA = [
  'Cerrado o sin nadie',
  'El cliente rechazó la mercadería',
  'Dirección incorrecta',
  'Otro',
] as const

/** La línea de apoyo de cada motivo (chofer-02b-no-entregado). Los códigos que viajan al servidor son los de arriba. */
export const DETALLE_MOTIVO_NO_ENTREGA: Record<(typeof MOTIVOS_NO_ENTREGA)[number], string> = {
  'Cerrado o sin nadie': 'No había quién recibiera',
  'El cliente rechazó la mercadería': 'No la quiso recibir',
  'Dirección incorrecta': 'No encontraste el lugar',
  Otro: 'Contanos qué pasó',
}
