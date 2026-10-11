import { MutationCache, QueryClient, type DefaultOptions, type Query } from '@tanstack/react-query'

/**
 * Raíz de las consultas de Inicio: resumen de Ventas y Compras. Cada mutación la invalida al terminar
 * (`crearQueryClient`); lo que cambia datos sin `useMutation` la invalida a mano.
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
    // Inicio resume Ventas y Compras: cualquier mutación lo puede mover, también una que falló (un 409
    // al autorizar: la venta cambió). Una sola regla acá en vez de una invalidación en cada mutación.
    // Sin devolver la promesa: react-query esperaría el refetch de Inicio (siempre montado) antes de
    // terminar la mutación. Afuera las que no cambian datos (`meta.noRefrescaInicio`, p. ej. el escaneo).
    mutationCache: new MutationCache({
      onSettled: (_data, _error, _variables, _contexto, mutation) => {
        if (!mutation.meta?.noRefrescaInicio) void queryClient.invalidateQueries({ queryKey: inicioKeys.all })
      },
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

/**
 * Mutaciones que se guardan: ninguna, ni las que quedaron en pausa sin red. No hay cola offline
 * (decisión M1 abierta): ninguna mutación registra `mutationKey` ni `setMutationDefaults`, así que una
 * guardada no se puede reanudar al reiniciar la app ("No mutationFn found") y solo dejaría en el
 * disco datos del negocio, o secretos (el cambio de contraseña lleva la actual y la nueva).
 */
export function debePersistirMutacion(): boolean {
  return false
}

/** Qué se guarda en el teléfono (`dehydrateOptions` de PersistQueryClientProvider). */
export const opcionesDePersistencia = {
  shouldDehydrateQuery: debePersistir,
  shouldDehydrateMutation: debePersistirMutacion,
}
