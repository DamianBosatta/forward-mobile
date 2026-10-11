import type { MovimientoCuentaDto, TipoCuentaSocio } from '@/libs/api-client/types'

/** Qué cuenta del cliente se mira: las dos juntas, o una sola. */
export type FiltroCuenta = 'ambas' | TipoCuentaSocio

export type MovimientoConCuenta = MovimientoCuentaDto & { cuenta: TipoCuentaSocio }

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
