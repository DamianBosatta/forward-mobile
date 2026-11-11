import type { EventoCalendario } from '@/libs/api-client/calendario'
import { ESTILO_ESTADO, TIPO, type TonoDePunto } from './presentacion'
import { depositoDe, ESTADOS_DE_TAREA, TIPO_TAREA, type EstadoTarea, type TipoTarea } from './tarea'

/**
 * Lo que dice cada evento en la semana, el mes, el día y la agenda: espejo de la web
 * (forward-frontend/apps/web/src/features/calendario/core/domain/resumen-evento.ts y depositos.ts).
 */
export type ClaseDeEvento = 'tarea' | 'entrega' | 'cobro' | 'empresa'

export interface ResumenDeEvento {
  clase: ClaseDeEvento
  /** En singular: lo que es este evento, no el nombre del filtro. */
  tipo: string
  estado: string
  tono: TonoDePunto
  /** A quién se le encargó, o null si no es de nadie en particular. */
  para: string | null
  /** Un evento omitido (cancelado) se tacha, como en la web. */
  tachado: boolean
}

const CLASE_DE_TAREA: Record<TipoTarea, ClaseDeEvento> = { General: 'tarea', EntregaPendiente: 'entrega', CobroPendiente: 'cobro' }

/** El punto de cada estado de tarea (la web, `PUNTO_ESTADO_TAREA`: info = en curso, success = hecha). */
const TONO_ESTADO_TAREA: Record<EstadoTarea, TonoDePunto> = { Pendiente: 'warning', EnCurso: 'info', Hecha: 'success', Cancelada: 'textSecondary' }
const TEXTO_ESTADO_TAREA = Object.fromEntries(ESTADOS_DE_TAREA.map((e) => [e.valor, e.texto])) as Record<EstadoTarea, string>

function tipoDe(e: EventoCalendario): string {
  if (e.tipoTarea) return TIPO_TAREA[e.tipoTarea]
  return e.tipo === 'Manual' ? 'Evento' : TIPO[e.tipo]
}

/**
 * Una tarea muestra su propio estado, no el del evento (una tarea hecha no está "Pagada"), salvo que esté vencida y
 * siga abierta: entonces dice "Vencido".
 */
export function resumenDeEvento(e: EventoCalendario): ResumenDeEvento {
  const nombres = (e.asignados ?? []).flatMap((a) => (a.nombre ? [a.nombre] : []))
  const abierta = e.estadoTarea === 'Pendiente' || e.estadoTarea === 'EnCurso'
  const deTarea = e.estadoTarea && !(abierta && e.estado === 'Vencido') ? e.estadoTarea : null
  const estilo = ESTILO_ESTADO[e.estado] ?? ESTILO_ESTADO.Pendiente
  return {
    clase: e.tipoTarea ? CLASE_DE_TAREA[e.tipoTarea] : 'empresa',
    tipo: tipoDe(e),
    estado: deTarea ? TEXTO_ESTADO_TAREA[deTarea] : estilo.etiqueta,
    tono: deTarea ? TONO_ESTADO_TAREA[deTarea] : estilo.tono,
    para: nombres.length > 0 ? nombres.join(', ') : null,
    tachado: !deTarea && e.estado === 'Cancelado',
  }
}

/** "09:30" aunque el servidor mande segundos; vacío si el evento no tiene hora. */
export const horaDeEvento = (e: Pick<EventoCalendario, 'hora'>) => (e.hora ? e.hora.slice(0, 5) : '')

/** Agrupa por día (YYYY-MM-DD), con los eventos de cada día ordenados por título, como la web. */
export function agruparPorDia(eventos: readonly EventoCalendario[]): Map<string, EventoCalendario[]> {
  const porDia = new Map<string, EventoCalendario[]>()
  for (const e of eventos) {
    const dia = e.fecha.slice(0, 10)
    const lista = porDia.get(dia)
    if (lista) lista.push(e)
    else porDia.set(dia, [e])
  }
  for (const lista of porDia.values()) lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
  return porDia
}

/** Valor del filtro de depósito para "todos" y para los eventos de la empresa (sin depósito). */
export const TODOS_LOS_DEPOSITOS = ''
export const SOLO_EMPRESA = 'empresa'

/** Los depósitos presentes en los eventos, por nombre, y "Empresa" si algún evento no tiene (no se pide la lista de depósitos). */
export function opcionesDeDeposito(eventos: readonly EventoCalendario[]): { valor: string; etiqueta: string }[] {
  const porId = new Map<string, string>()
  let hayEmpresa = false
  for (const e of eventos) {
    if (e.depositoId) porId.set(e.depositoId, depositoDe(e))
    else hayEmpresa = true
  }
  const depositos = [...porId].map(([valor, etiqueta]) => ({ valor, etiqueta }))
  depositos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  return hayEmpresa ? [...depositos, { valor: SOLO_EMPRESA, etiqueta: 'Empresa' }] : depositos
}

export function filtrarPorDeposito(eventos: readonly EventoCalendario[], valor: string): EventoCalendario[] {
  if (valor === TODOS_LOS_DEPOSITOS) return [...eventos]
  return eventos.filter((e) => (valor === SOLO_EMPRESA ? !e.depositoId : e.depositoId === valor))
}
