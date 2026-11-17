import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { comisionesKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'
import { subtotalLinea, type LineaCarrito } from '../lib/carrito'

type Simulacion = components['schemas']['SimulacionComisionDto']

/**
 * "Tu comisión estimada" (bloque 7): la calcula el servidor con POST /comisiones/simulacion, el
 * mismo cálculo del devengo, con lo cargado y las reglas de hoy. Se pide 600 ms después del último
 * cambio. Devuelve el monto solo si hay comisión activa y algo que cobrar (un chip en cero sería
 * una promesa falsa, igual que en la web).
 */
export function useComisionEstimada(lineas: LineaCarrito[], descuentoGeneral: number, cargoFlete = 0, porcentajeComisionCedido?: number): number | null {
  const pedido = lineas.length === 0 ? null : JSON.stringify({
    lineas: lineas.map((l) => ({ productoId: l.productoId, subtotal: subtotalLinea(l) })),
    descuentoGeneral,
    cargoFlete,
    porcentajeComisionCedido,
  })
  const estable = useDebouncedValue(pedido, 600)
  const { data } = useQuery({
    queryKey: [...comisionesKeys.simulacion, estable],
    queryFn: () => api.post<Simulacion>('/api/v1/comisiones/simulacion', JSON.parse(estable!)),
    enabled: !!estable,
    staleTime: 60_000,
  })
  if (!pedido || !data || !data.comisionActiva || data.montoCobro <= 0) return null
  return data.montoComision
}
