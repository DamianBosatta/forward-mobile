import { useEffect, useState } from 'react'
import { useCuentaMovimientos, useMovimientosSocio } from '../api/queries'
import { unirMovimientos, type FiltroCuenta, type MovimientoConCuenta, type MovimientosDeCuenta } from '../lib/movimientos'
import type { TipoCuentaSocio } from '@/libs/api-client/types'

interface CuentasDelCliente {
  /** La cuenta TST (la principal). El servidor la manda en null si el usuario no puede verla. */
  cuentaId?: string | null
  cuentaNormalId?: string | null
}

/**
 * Movimientos de la cuenta corriente de un cliente, las dos cuentas (TST y Normal) juntas o una sola.
 *
 * Con el servidor nuevo (forward-system #905) sale de UN endpoint paginado por el socio, con el
 * vencimiento y a qué se aplicó cada crédito. Si el servidor todavía no lo tiene (404), cada cuenta
 * se pide a su endpoint de movimientos —los ids salen de la ficha del cliente— y se unen por fecha,
 * como antes. Esas dos pedidas no arrancan hasta saber que el endpoint nuevo no está.
 */
export function useMovimientosDeCliente(socioId: string, cuentas: CuentasDelCliente, filtro: FiltroCuenta, habilitado = true) {
  // Una vez que el servidor dijo que no tiene el endpoint, no se vuelve a preguntar al cambiar de cuenta.
  const [servidorSinEndpoint, setServidorSinEndpoint] = useState(false)
  const nuevo = useMovimientosSocio(socioId, filtro, habilitado && !servidorSinEndpoint)
  const conServidorNuevo = !servidorSinEndpoint && nuevo.isSuccess && nuevo.data.pages[0] != null
  const sinServidorNuevo = servidorSinEndpoint || (nuevo.isSuccess && !conServidorNuevo)
  useEffect(() => {
    if (sinServidorNuevo) setServidorSinEndpoint(true)
  }, [sinServidorNuevo])

  const tst = useCuentaMovimientos(cuentas.cuentaId, habilitado && sinServidorNuevo && filtro !== 'Normal')
  const normal = useCuentaMovimientos(cuentas.cuentaNormalId, habilitado && sinServidorNuevo && filtro !== 'Tst')

  if (!sinServidorNuevo) {
    return {
      movimientos: (nuevo.data?.pages ?? []).flatMap(p => p?.items ?? []) as MovimientoConCuenta[],
      hayMas: !!nuevo.hasNextPage,
      cargando: nuevo.isLoading,
      cargandoMas: nuevo.isFetchingNextPage,
      error: nuevo.error ?? null,
      conServidorNuevo,
      // cancelRefetch: false — el desplazamiento dispara varias veces seguidas: mientras una página viaja, las demás no hacen nada.
      cargarMas: () => {
        if (nuevo.hasNextPage) nuevo.fetchNextPage({ cancelRefetch: false })
      },
    }
  }

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
    conServidorNuevo,
    cargarMas: () => {
      for (const f of activas) if (f.q.hasNextPage && !f.q.isFetchingNextPage) f.q.fetchNextPage()
    },
  }
}
