import { partesArgentina } from '@/src/utils/date'

export interface DiaEntrega {
  /** YYYY-MM-DD del calendario argentino: lo que interpreta el servidor. */
  fecha: string
  numero: number
  semana: string
  esHoy: boolean
}

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Hoy y los próximos días hábiles (sin sábado ni domingo) del calendario argentino, como la
 * lámina PedidosPorPreparar. Los feriados se marcan aparte: vienen del servidor.
 */
export function proximosDiasDeEntrega(ahoraMs: number, cantidad = 5): DiaEntrega[] {
  const dias: DiaEntrega[] = []
  for (let i = 0; dias.length < cantidad && i < cantidad * 3; i++) {
    const p = partesArgentina(ahoraMs + i * MS_POR_DIA)
    if (i > 0 && (p.diaSemana === 0 || p.diaSemana === 6)) continue
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
