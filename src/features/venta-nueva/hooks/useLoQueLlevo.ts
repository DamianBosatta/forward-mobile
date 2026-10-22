import { useMemo } from 'react'
import { useVenta } from '@/libs/api-client/ventas'
import { useUltimoPedido } from './useUltimoPedido'

/**
 * Lo que el cliente llevó en su último pedido (producto → cantidad), para el filtro "Del último pedido" y la
 * pista "Llevó 12 la última vez" del catálogo rápido. Es el historial que ya existe; sin último pedido, o
 * mientras se trae, el mapa es null y el filtro no se ofrece.
 */
export function useLoQueLlevo(clienteId: string | undefined): Map<string, number> | null {
  const { ultimo } = useUltimoPedido(clienteId)
  const detalle = useVenta(ultimo?.id ?? '')
  const detalles = detalle.data?.detalles
  return useMemo(() => (detalles ? new Map(detalles.map((d) => [d.productoId, d.cantidad])) : null), [detalles])
}
