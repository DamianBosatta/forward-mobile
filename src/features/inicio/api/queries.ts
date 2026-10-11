import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/libs/api-client/client'
import { comprasKeys } from '@/libs/api-client/compras'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'

type Schemas = components['schemas']
type ComprasResumenDto = Schemas['ComprasResumenDto']
export type PendienteInicio = Schemas['InicioPendienteDto']
export type ImporteInicio = Schemas['InicioImporteDto']

/**
 * InicioResumenDto con cada sección que el usuario no puede ver en `null`: el servidor la manda
 * `null` aunque el tipo generado la marque opcional. Una fila en 0 sí llega (0 = nada pendiente).
 */
export interface ResumenInicio {
  ventas: Schemas['InicioVentasDto'] | null
  compras: Schemas['InicioComprasDto'] | null
  autorizacionesPendientes: PendienteInicio | null
}

// Las claves cuelgan de ventasKeys.all / comprasKeys.all: cualquier alta o cambio que invalide
// Ventas o Compras también refresca Inicio. El resumen mezcla los dos módulos y una clave no puede
// colgar de los dos: cuelga de Ventas, y para Compras hay un testigo (useInvalidarConCompras).
const resumenKey = [...ventasKeys.all, 'inicio', 'resumen'] as const

/**
 * GET /api/v1/Inicio/resumen (forward-system #876): los pendientes de Inicio con importes por
 * moneda, en una sola llamada. `data === null`: el servidor todavía no tiene el endpoint (404) e
 * Inicio vuelve a las cuatro llamadas de antes. Un 403 (usuario desactivado) queda como error.
 */
export function useResumenInicio(enabled: boolean) {
  useInvalidarConCompras(enabled)
  return useQuery({
    queryKey: resumenKey,
    queryFn: async (): Promise<ResumenInicio | null> => {
      try {
        const r = await api.get<Schemas['InicioResumenDto']>('/api/v1/Inicio/resumen')
        return { ventas: r?.ventas ?? null, compras: r?.compras ?? null, autorizacionesPendientes: r?.autorizacionesPendientes ?? null }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    staleTime: 30_000,
    enabled,
  })
}

let marcas = 0

/**
 * Testigo de Compras: una consulta sin red bajo comprasKeys.all. Cuando una mutación de Compras la
 * invalida, se vuelve a "pedir" (enseguida, o al volver a Inicio si no estaba en pantalla), su marca
 * cambia y eso invalida el resumen. No se guarda en el teléfono: la marca no vale entre sesiones.
 */
function useInvalidarConCompras(enabled: boolean) {
  const qc = useQueryClient()
  const { data: marca } = useQuery({
    queryKey: [...comprasKeys.all, 'inicio', 'testigo'] as const,
    queryFn: () => ++marcas,
    staleTime: Infinity,
    meta: { persist: false },
    enabled,
  })
  const vista = useRef(marca)
  useEffect(() => {
    if (marca === undefined) return
    if (vista.current !== undefined && vista.current !== marca) void qc.invalidateQueries({ queryKey: resumenKey })
    vista.current = marca
  }, [marca, qc])
}

/** Servidor sin /Inicio/resumen: contadores por estado de TODAS las compras (GET /Compras/resumen sin filtros). */
export function useComprasResumenInicio(enabled: boolean) {
  return useQuery({
    queryKey: [...comprasKeys.all, 'inicio', 'resumen'] as const,
    queryFn: () => api.get<ComprasResumenDto>('/api/v1/Compras/resumen'),
    staleTime: 30_000,
    enabled,
  })
}
