import { useCuentaMovimientos } from '../api/queries'
import { unirMovimientos, type FiltroCuenta, type MovimientosDeCuenta } from '../lib/movimientos'
import type { TipoCuentaSocio } from '@/libs/api-client/types'

interface CuentasDelCliente {
  /** La cuenta TST (la principal). El servidor la manda en null si el usuario no puede verla. */
  cuentaId?: string | null
  cuentaNormalId?: string | null
}

/**
 * Movimientos de la cuenta corriente de un cliente: las dos cuentas (TST y Normal) juntas o una
 * sola. Cada cuenta se pide a su endpoint de movimientos; los ids salen de la ficha del cliente.
 */
export function useMovimientosDeCliente(cuentas: CuentasDelCliente, filtro: FiltroCuenta) {
  const tst = useCuentaMovimientos(cuentas.cuentaId, filtro !== 'Normal')
  const normal = useCuentaMovimientos(cuentas.cuentaNormalId, filtro !== 'Tst')
  const activas = [
    { cuenta: 'Tst' as TipoCuentaSocio, q: tst, id: cuentas.cuentaId },
    { cuenta: 'Normal' as TipoCuentaSocio, q: normal, id: cuentas.cuentaNormalId },
  ].filter(f => f.id && (filtro === 'ambas' || filtro === f.cuenta))

  const fuentes: MovimientosDeCuenta[] = activas.map(f => ({
    cuenta: f.cuenta,
    items: (f.q.data?.pages ?? []).flatMap(p => p?.movimientos?.items ?? []),
    hayMas: !!f.q.hasNextPage,
  }))

  return {
    movimientos: unirMovimientos(fuentes),
    hayMas: fuentes.some(f => f.hayMas),
    cargando: activas.some(f => f.q.isLoading),
    cargandoMas: activas.some(f => f.q.isFetchingNextPage),
    error: activas.find(f => f.q.error)?.q.error ?? null,
    cargarMas: () => {
      for (const f of activas) if (f.q.hasNextPage && !f.q.isFetchingNextPage) f.q.fetchNextPage()
    },
  }
}
