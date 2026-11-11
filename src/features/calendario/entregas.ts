import { useMemo } from 'react'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { diaDeLaSemana } from './presentacion'

/**
 * Qué días hay entregas, para marcar en la semana y el mes "Sin entregas" y "Feriado", como la web
 * (`useCalendarioDeEntregas` y `esDiaDeEntrega`): los días de semana habilitados menos los feriados. Mientras la
 * configuración no llegó (o falló) no se marca nada.
 */
type Dias = NonNullable<ReturnType<typeof useDiasEntrega>['data']>
const CLAVES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

export interface MarcaDeEntregas {
  sinEntregas: boolean
  /** "Feriado" o "Feriado: Día de la Bandera"; null si no es feriado. */
  feriado: string | null
}

export function useEntregasDelCalendario(desde: string): ((fecha: string) => MarcaDeEntregas) | null {
  const dias = useDiasEntrega()
  const feriados = useFeriados(desde)
  return useMemo(() => {
    if (!dias.data || !Array.isArray(feriados.data)) return null
    const habilitados: Dias = dias.data
    const porDia = new Map<string, string>()
    for (const f of feriados.data) {
      if (f.fecha) porDia.set(f.fecha.slice(0, 10), f.descripcion?.trim() ? `Feriado: ${f.descripcion.trim()}` : 'Feriado')
    }
    return (fecha: string) => {
      const feriado = porDia.get(fecha) ?? null
      return { feriado, sinEntregas: feriado !== null || habilitados[CLAVES[diaDeLaSemana(fecha)]] !== true }
    }
  }, [dias.data, feriados.data])
}
