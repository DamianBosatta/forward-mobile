import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { components } from '@/libs/api-client/generated/schema'
import { subtotalLinea, type LineaCarrito } from '../lib/carrito'

type Simulacion = components['schemas']['SimulacionComisionDto']
const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * "Tu comisión estimada" (bloque 7): la calcula el servidor con POST /comisiones/simulacion, el
 * mismo cálculo del devengo, con lo cargado y las reglas de hoy. Se pide 600 ms después del último
 * cambio. Devuelve el monto solo si hay comisión activa y algo que cobrar (un chip en cero sería
 * una promesa falsa, igual que en la web).
 */
export function useComisionEstimada(lineas: LineaCarrito[], descuentoGeneral: number, cargoFlete = 0): number | null {
  const pedido = lineas.length === 0 ? null : JSON.stringify({
    lineas: lineas.map((l) => ({ productoId: l.productoId, subtotal: centavos(subtotalLinea(l)) })),
    descuentoGeneral,
    cargoFlete,
  })
  const [estable, setEstable] = useState(pedido)
  useEffect(() => {
    const t = setTimeout(() => setEstable(pedido), 600)
    return () => clearTimeout(t)
  }, [pedido])
  const { data } = useQuery({
    queryKey: ['comisiones', 'simulacion', estable],
    queryFn: () => api.post<Simulacion>('/api/v1/comisiones/simulacion', JSON.parse(estable!)),
    enabled: !!estable,
    staleTime: 60_000,
  })
  if (!pedido || !data || !data.comisionActiva || data.montoCobro <= 0) return null
  return data.montoComision
}
