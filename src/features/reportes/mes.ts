import { partesArgentina } from '@/src/utils/date'

/** Un mes calendario; `mes` va de 1 a 12, como lo recibe el servidor. */
export interface Mes {
  anio: number
  mes: number
}

const NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** El mes argentino de un instante: a las 22:30 del 31 de octubre en Argentina sigue siendo octubre. */
export function mesDe(ms: number): Mes {
  const p = partesArgentina(ms)
  return { anio: p.anio, mes: p.mes + 1 }
}

export function moverMes({ anio, mes }: Mes, delta: number): Mes {
  const indice = anio * 12 + (mes - 1) + delta
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 }
}

export const mismoMes = (a: Mes, b: Mes) => a.anio === b.anio && a.mes === b.mes

export const tituloMes = ({ anio, mes }: Mes) => `${NOMBRES[mes - 1]} ${anio}`
