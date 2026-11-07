import type { EventoCalendario, EventoDetalle } from '@/libs/api-client/calendario'

/**
 * Lo que el contrato del calendario agrega por tarea (S8) y el cliente generado todavía no trae: se tipa a mano solo lo que
 * mobile consume. Todo es opcional: un servidor viejo, o un evento que no es tarea, no lo manda.
 */
export type TipoTarea = 'General' | 'EntregaPendiente' | 'CobroPendiente'
export type EstadoTarea = 'Pendiente' | 'EnCurso' | 'Hecha' | 'Cancelada'

export interface CamposTarea {
  depositoId?: string | null
  depositoNombre?: string | null
  tipoTarea?: TipoTarea | null
  estadoTarea?: EstadoTarea | null
  asignados?: { id: string; nombre: string }[] | null
  socioNombre?: string | null
}

export type EventoConTarea = EventoCalendario & CamposTarea
export type DetalleConTarea = EventoDetalle & CamposTarea

/** Una tarea asignada a alguien (de entrega o de cobro, o general con responsables): se ve, no se edita desde mobile. */
export const esTareaAsignada = (e: CamposTarea) =>
  e.tipoTarea === 'EntregaPendiente' || e.tipoTarea === 'CobroPendiente' || (e.asignados?.length ?? 0) > 0

/** El cobro se ofrece mientras la tarea siga abierta. La tarea nunca mueve plata: el cobro va por el flujo de cobranza. */
export const cobroAbierto = (e: CamposTarea) =>
  e.tipoTarea === 'CobroPendiente' && (e.estadoTarea === 'Pendiente' || e.estadoTarea === 'EnCurso')

export const depositoDe = (e: CamposTarea) => e.depositoNombre?.trim() || 'Empresa'

export const TIPO_TAREA: Record<TipoTarea, string> = {
  General: 'Tarea',
  EntregaPendiente: 'Entrega pendiente',
  CobroPendiente: 'Cobro pendiente',
}

/** Los estados que ofrece la web, en su orden y con su texto. */
export const ESTADOS_DE_TAREA: { valor: EstadoTarea; texto: string }[] = [
  { valor: 'Pendiente', texto: 'Pendiente' },
  { valor: 'EnCurso', texto: 'En curso' },
  { valor: 'Hecha', texto: 'Hecha' },
  { valor: 'Cancelada', texto: 'Cancelada' },
]
