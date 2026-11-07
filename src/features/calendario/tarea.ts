import type { EventoCalendario, EventoDetalle } from '@/libs/api-client/calendario'
import type { components } from '@/libs/api-client/generated/schema'

export type TipoTarea = components['schemas']['TipoTarea']
export type EstadoTarea = components['schemas']['EstadoTarea']

/** Campos de tarea del contrato. Un evento que no es tarea no los manda, y un servidor viejo tampoco. */
export type CamposTarea = Pick<EventoCalendario, 'depositoNombre' | 'tipoTarea' | 'estadoTarea' | 'asignados'>

export type EventoConTarea = EventoCalendario
export type DetalleConTarea = EventoDetalle

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
