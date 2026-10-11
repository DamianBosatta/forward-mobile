import { partesArgentina } from '@/src/utils/date'

export interface DiaEntrega {
  /** YYYY-MM-DD del calendario argentino: lo que interpreta el servidor. */
  fecha: string
  numero: number
  semana: string
  esHoy: boolean
}

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Días de entrega configurados en el servidor (`GET /Configuracion/dias-entrega`). */
export type DiasHabilitados = Partial<Record<'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo', boolean>>
const CLAVE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
/** Mientras el servidor no responde: de lunes a viernes. */
const LUN_A_VIE: DiasHabilitados = { lunes: true, martes: true, miercoles: true, jueves: true, viernes: true }
const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Hoy y los próximos días de entrega del calendario argentino, como la lámina PedidosPorPreparar.
 * Los días de entrega los configura el servidor (`habilitados`); los feriados se marcan aparte.
 */
export function proximosDiasDeEntrega(ahoraMs: number, habilitados: DiasHabilitados = LUN_A_VIE, cantidad = 5): DiaEntrega[] {
  const dias: DiaEntrega[] = []
  for (let i = 0; dias.length < cantidad && i < 28; i++) {
    const p = partesArgentina(ahoraMs + i * MS_POR_DIA)
    if (i > 0 && !habilitados[CLAVE[p.diaSemana]]) continue
    const dos = (n: number) => String(n).padStart(2, '0')
    dias.push({
      fecha: `${p.anio}-${dos(p.mes + 1)}-${dos(p.dia)}`,
      numero: p.dia,
      semana: SEMANA[p.diaSemana],
      esHoy: i === 0,
    })
  }
  return dias
}

/** "Hoy" o "mar 13", para el resumen y los avisos. */
export function nombreDelDia(d: DiaEntrega): string {
  return d.esHoy ? 'Hoy' : `${d.semana} ${d.numero}`
}
