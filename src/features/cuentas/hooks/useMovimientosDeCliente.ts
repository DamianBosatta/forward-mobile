import { useEffect, useState } from 'react'
import { useCuentaMovimientos, useMovimientosSocio } from '../api/queries'
import { unirMovimientos, type FiltroCuenta, type MovimientoConCuenta, type MovimientosDeCuenta } from '../lib/movimientos'
import type { TipoCuentaSocio } from '@/libs/api-client/types'
import type { RangoDeDias } from '../lib/periodo'

interface CuentasDelCliente {
  /** La cuenta TST (la principal). El servidor la manda en null si el usuario no puede verla. */
  cuentaId?: string | null
  cuentaNormalId?: string | null
}

/**
 * Movimientos de la cuenta corriente de un cliente, las dos cuentas (TST y Normal) juntas o una sola.
 *
 * Con el servidor nuevo (forward-system #905) sale de UN endpoint paginado por el socio, con el
 * vencimiento y a qué se aplicó cada crédito. Si la primera página falla por lo que sea (404 de un
 * servidor sin el endpoint, 500, sin red), cada cuenta se pide a su endpoint de movimientos —los ids
 * salen de la ficha del cliente— y se unen por fecha, como antes; y no se vuelve a probar el nuevo
 * hasta que se reabra la pantalla. Esas dos pedidas no arrancan hasta saber que el nuevo no sirve.
 */
export function useMovimientosDeCliente(socioId: string, cuentas: CuentasDelCliente, filtro: FiltroCuenta, habilitado = true, rango?: RangoDeDias) {
  // Una vez que el servidor dijo que no tiene el endpoint, no se vuelve a preguntar al cambiar de cuenta.
  const [servidorSinEndpoint, setServidorSinEndpoint] = useState(false)
  const nuevo = useMovimientosSocio(socioId, filtro, habilitado && !servidorSinEndpoint, rango)
  const conServidorNuevo = !servidorSinEndpoint && nuevo.isSuccess && nuevo.data.pages[0] != null
  const sinServidorNuevo = servidorSinEndpoint || (nuevo.isSuccess && !conServidorNuevo)
  useEffect(() => {
    if (sinServidorNuevo) setServidorSinEndpoint(true)
  }, [sinServidorNuevo])

  const tst = useCuentaMovimientos(cuentas.cuentaId, habilitado && sinServidorNuevo && filtro !== 'Normal', rango)
  const normal = useCuentaMovimientos(cuentas.cuentaNormalId, habilitado && sinServidorNuevo && filtro !== 'Tst', rango)

  if (!sinServidorNuevo) {
    // El corrimiento del offset (un movimiento nuevo entre dos páginas) puede repetir un asiento: una sola vez cada id.
    const vistos = new Map<string, MovimientoConCuenta>()
    for (const p of nuevo.data?.pages ?? []) for (const m of p?.items ?? []) if (!vistos.has(m.id)) vistos.set(m.id, m)
    const falloPaginaSiguiente = nuevo.isFetchNextPageError
    // cancelRefetch: false — el desplazamiento dispara varias veces seguidas: mientras una página viaja, las demás no hacen nada.
    const pedirSiguiente = () => {
      if (nuevo.hasNextPage) nuevo.fetchNextPage({ cancelRefetch: false })
    }
    return {
      movimientos: [...vistos.values()],
      hayMas: !!nuevo.hasNextPage,
      cargando: nuevo.isLoading,
      cargandoMas: nuevo.isFetchingNextPage,
      error: falloPaginaSiguiente ? null : nuevo.error ?? null,
      errorPaginaSiguiente: falloPaginaSiguiente ? nuevo.error : null,
      conServidorNuevo,
      // Con la página siguiente fallida el desplazamiento no insiste: solo "Reintentar".
      cargarMas: () => {
        if (!falloPaginaSiguiente) pedirSiguiente()
      },
      reintentar: pedirSiguiente,
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
    errorPaginaSiguiente: null,
    conServidorNuevo,
    cargarMas: () => {
      for (const f of activas) if (f.q.hasNextPage && !f.q.isFetchingNextPage) f.q.fetchNextPage()
    },
    reintentar: () => {},
  }
}
