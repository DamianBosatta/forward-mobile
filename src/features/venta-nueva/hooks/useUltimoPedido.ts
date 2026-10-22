import { useMemo } from 'react'
import { useVentas } from '@/libs/api-client/ventas'
import { elegirUltimoPedido, TIPO_PEDIDO } from '../lib/ultimoPedido'

/**
 * El último pedido del cliente, del historial de ventas que ya existe (D5: "Repetir el último pedido" no
 * necesita endpoint nuevo). Sin cliente no pide nada. Se pide una página amplia y se elige el más reciente
 * en el teléfono: no se supone en qué orden responde el servidor.
 */
export function useUltimoPedido(clienteId: string | undefined) {
  const q = useVentas({ clienteId, tipoOperacion: TIPO_PEDIDO, pageSize: 50 }, { enabled: !!clienteId })
  const items = q.data?.items
  const ultimo = useMemo(() => elegirUltimoPedido(items), [items])
  return { ultimo, cargando: !!clienteId && q.isLoading, error: q.isError }
}
