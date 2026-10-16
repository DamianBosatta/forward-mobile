import { useEffect, useMemo, useState } from 'react'
import { useInfiniteSocios } from '@/libs/api-client/socios'
import type { SocioListDto } from '@/libs/api-client/types'
import type { FiltrosDeCartera } from '../components/FiltrosCartera'

/** Espera entre la última tecla y el pedido al servidor. */
export const ESPERA_BUSQUEDA_MS = 300

/** Devuelve `valor` recién cuando dejó de cambiar durante `ms`. */
export function useValorDiferido<T>(valor: T, ms = ESPERA_BUSQUEDA_MS): T {
  const [diferido, setDiferido] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return diferido
}

/**
 * Cartera de clientes activos, paginada y buscada EN EL SERVIDOR (dirección, nombre de fantasía,
 * contacto, razón social o CUIT). Con `agenda` el servidor acota al vendedor sin gestión de cartera
 * a sus clientes y a los "de la casa": mobile no filtra nada por su cuenta. Los filtros de localidad
 * y deuda vencida también los aplica el servidor, antes de paginar.
 */
export function useCartera(busqueda: string, filtros?: FiltrosDeCartera) {
  const texto = useValorDiferido(busqueda.trim())
  const query = useInfiniteSocios({
    tipo: 1,
    activo: true,
    agenda: true,
    search: texto,
    pageSize: 20,
    ...(filtros?.localidad ? { localidad: filtros.localidad } : {}),
    ...(filtros?.conDeudaVencida ? { conDeudaVencida: true } : {}),
  })
  const pages = query.data?.pages

  const clientes = useMemo<SocioListDto[]>(() => (pages ?? []).flatMap(p => p?.items ?? []), [pages])
  const ultima = pages?.[pages.length - 1]
  const totalCount = typeof ultima?.totalCount === 'number' ? ultima.totalCount : undefined
  // Solo la página 1 lo trae (las demás, null). Nunca se suma en el teléfono.
  const saldo = pages?.[0]?.saldoTotal
  const saldoTotal = typeof saldo === 'number' ? saldo : undefined

  return {
    clientes,
    totalCount,
    saldoTotal,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    cargarMas: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
    },
  }
}
