import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ImputacionMovimientoDto, MovimientoCuentaDto, MovimientoSocioDto, TipoCuentaSocio } from '@/libs/api-client/types'

/** Qué cuenta del cliente se mira: las dos juntas, o una sola. */
export type FiltroCuenta = 'ambas' | TipoCuentaSocio

/**
 * Un movimiento de la lista con la cuenta en la que está. Del servidor nuevo (forward-system #905) trae
 * además el comprobante, el vencimiento y a qué se aplicó; del anterior, el medio de pago.
 */
export type MovimientoConCuenta = MovimientoCuentaDto & { cuenta: TipoCuentaSocio } &
  Partial<Pick<MovimientoSocioDto, 'comprobante' | 'vencimiento' | 'imputadoA'>>

/** Lo que ya llegó del servidor de una cuenta: sus páginas cargadas y si quedan más. */
export interface MovimientosDeCuenta {
  cuenta: TipoCuentaSocio
  items: MovimientoCuentaDto[]
  hayMas: boolean
}

export const NOMBRE_CUENTA: Record<TipoCuentaSocio, string> = { Tst: 'Cuenta TST', Normal: 'Cuenta Normal' }

const instante = (fecha: string) => new Date(fecha).getTime()

/**
 * Los movimientos de las dos cuentas en una sola lista, del más nuevo al más viejo, cada uno con
 * la cuenta en la que está. El servidor pagina cada cuenta por separado: si una cuenta todavía
 * tiene páginas sin pedir, no se muestra nada más viejo que lo último que llegó de ella, porque
 * ahí podrían faltar movimientos suyos y la lista saldría con huecos.
 */
export function unirMovimientos(fuentes: MovimientosDeCuenta[]): MovimientoConCuenta[] {
  const cortes = fuentes
    .filter(f => f.hayMas && f.items.length > 0)
    .map(f => Math.min(...f.items.map(m => instante(m.fecha))))
  const corte = cortes.length > 0 ? Math.max(...cortes) : -Infinity

  return fuentes
    .flatMap(f => f.items.map(m => ({ ...m, cuenta: f.cuenta })))
    .filter(m => instante(m.fecha) >= corte)
    .sort((a, b) => instante(b.fecha) - instante(a.fecha) || (a.id < b.id ? 1 : -1))
}

/** "17 oct" para un día AAAA-MM-DD, sin pasar por un instante: el día del servidor no se corre por el huso del teléfono. */
export function diaCorto(dia: string): string {
  const [anio, mes, d] = dia.split('-').map(Number)
  if (!anio || !mes || !d) return ''
  return format(new Date(anio, mes - 1, d), 'd MMM', { locale: es })
}

/** "Vence 17 oct", o cadena vacía si el movimiento no vence (no es una deuda, ya se saldó o el servidor no lo sabe). */
export function textoVencimiento(vencimiento: string | null | undefined): string {
  const dia = vencimiento ? diaCorto(vencimiento) : ''
  return dia ? `Vence ${dia}` : ''
}

const IMPUTACIONES_VISIBLES = 3

/** "Imputado a A00409, A00410 y 2 más", o cadena vacía si todavía no se aplicó a nada. */
export function textoImputacion(imputadoA: ImputacionMovimientoDto[] | null | undefined): string {
  const comprobantes = (imputadoA ?? []).map(i => i.comprobante).filter(Boolean)
  if (comprobantes.length === 0) return ''
  const visibles = comprobantes.slice(0, IMPUTACIONES_VISIBLES).join(', ')
  const resto = comprobantes.length - IMPUTACIONES_VISIBLES
  return resto > 0 ? `Imputado a ${visibles} y ${resto} más` : `Imputado a ${visibles}`
}

/** El concepto con el código de la venta cuando el servidor lo manda y el concepto no lo dice ya. */
export function descripcionDe(m: Pick<MovimientoConCuenta, 'referencia' | 'comprobante'>): string {
  const comprobante = m.comprobante?.trim()
  return comprobante && !m.referencia.includes(comprobante) ? `${m.referencia} · ${comprobante}` : m.referencia
}
