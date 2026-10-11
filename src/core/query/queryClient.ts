import { MutationCache, QueryClient, type DefaultOptions, type Query } from '@tanstack/react-query'

/**
 * Raíz de las consultas de Inicio: resumen de Ventas y Compras. Cualquier mutación exitosa la
 * invalida (`crearQueryClient`); lo que cambia datos sin `useMutation` la invalida a mano.
 */
export const inicioKeys = {
  all: ['inicio'] as const,
  resumen: () => [...inicioKeys.all, 'resumen'] as const,
}

/**
 * El QueryClient de la app (app/_layout.tsx). Los tests lo crean con esto para tener la misma
 * configuración; `consultas` pisa los valores por defecto de las consultas (p. ej. `retry: false`).
 */
export function crearQueryClient(consultas: DefaultOptions['queries'] = {}): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    // Inicio resume Ventas y Compras: cualquier cambio confirmado por el servidor lo puede mover. Una
    // sola regla acá en vez de una invalidación en cada mutación; si Inicio no está en pantalla, se
    // pide de nuevo al volver.
    mutationCache: new MutationCache({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: inicioKeys.all }),
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 24 * 60 * 60_000, retry: 1, ...consultas },
    },
  })
  return queryClient
}

/** Qué consultas se guardan en el teléfono para abrir sin conexión. */
export function debePersistir(query: Query): boolean {
  if (query.state.status !== 'success') return false
  // `null` es "no hay dato" (p. ej. el servidor todavía no tiene el endpoint): no vale para después.
  if (query.state.data === null) return false
  if (query.meta && query.meta.persist === false) return false
  const queryKey = query.queryKey as string[]
  const isHeavy = queryKey.includes('catalogoStock') || queryKey.includes('list')
  return !isHeavy
}
