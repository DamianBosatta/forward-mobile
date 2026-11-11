import { useCallback, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CLAVE_CATALOGO, claveCatalogo } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { useDepositoAjenoDeVenta } from '@/features/venta-nueva/hooks/useDepositoDeVenta'
import { horaDe } from '@/features/ventas/lib/agruparPorDia'

/** La clave del catálogo completo de la venta: la misma de `useCatalogoVenta` (una sola copia). */
export const CLAVE_CATALOGO_VENTA = CLAVE_CATALOGO

/**
 * "Precios y stock de las HH:MM" (V9): la hora argentina (X9) en que llegó el catálogo que está
 * usando la venta: el del depósito de la venta (el de la sesión, o el elegido para la venta en curso), que sin
 * elección es el que se guarda en el teléfono (S3). `null` si todavía no hay catálogo.
 */
export function useHoraDelCatalogo(): string | null {
  const qc = useQueryClient()
  const clave = claveCatalogo(useDepositoAjenoDeVenta())
  const suscribir = useCallback((avisar: () => void) => qc.getQueryCache().subscribe(avisar), [qc])
  const ms = useSyncExternalStore(suscribir, () => qc.getQueryState(clave)?.dataUpdatedAt ?? 0)
  return ms ? horaDe(new Date(ms).toISOString()) : null
}
