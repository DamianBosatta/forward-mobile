import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseDateSafe, partesArgentina } from '@/src/utils/date'

/**
 * "Jueves 22/10": la fecha de entrega llega como instante UTC y el día es el argentino (X9), igual que en la
 * tarjeta de la lista. Es el único cálculo del día de entrega.
 */
export function diaDeEntregaCorto(fecha: string | null | undefined): string | null {
  const instante = parseDateSafe(fecha)
  if (!instante) return null
  const f = partesArgentina(instante.getTime())
  const texto = format(new Date(f.anio, f.mes, f.dia), 'EEEE dd/MM', { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
