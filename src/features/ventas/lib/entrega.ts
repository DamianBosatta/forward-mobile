import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { diaCalendarioSinOffset, parseDateSafe, partesArgentina } from '@/core/utils/fecha'

function diaDelInstante(fecha: string | null | undefined) {
  const instante = parseDateSafe(fecha)
  return instante ? partesArgentina(instante.getTime()) : null
}

/**
 * "Jueves 22/10": un texto sin offset es un día de negocio y se muestra tal cual en cualquier huso del teléfono;
 * uno con offset es un instante y el día es el argentino (X9), igual que en la tarjeta de la lista. Es el único
 * cálculo del día de entrega.
 */
export function diaDeEntregaCorto(fecha: string | null | undefined): string | null {
  const f = diaCalendarioSinOffset(fecha) ?? diaDelInstante(fecha)
  if (!f) return null
  const texto = format(new Date(f.anio, f.mes, f.dia), 'EEEE dd/MM', { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
