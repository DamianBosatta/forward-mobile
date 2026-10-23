import { useCallback, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { productosKeys } from '@/libs/api-client'
import { horaDe } from '@/features/ventas/lib/agruparPorDia'

/**
 * La clave del catálogo completo de la venta (`useCatalogoVenta`, venta-nueva). Está escrita igual
 * acá porque ese archivo no la exporta; el test de este hook carga los dos y se rompe si dejan de coincidir.
 */
export const CLAVE_CATALOGO_VENTA = [...productosKeys.all, 'catalogoVenta', 'completo'] as const

/**
 * "Precios y stock de las HH:MM" (V9): la hora argentina (X9) en que llegó el catálogo que está
 * usando la venta, la que se guarda en el teléfono. `null` si todavía no hay catálogo.
 */
export function useHoraDelCatalogo(): string | null {
  const qc = useQueryClient()
  const suscribir = useCallback((avisar: () => void) => qc.getQueryCache().subscribe(avisar), [qc])
  const ms = useSyncExternalStore(suscribir, () => qc.getQueryState(CLAVE_CATALOGO_VENTA)?.dataUpdatedAt ?? 0)
  return ms ? horaDe(new Date(ms).toISOString()) : null
}
