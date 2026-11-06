import { useQuery } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { fetchDisponibilidad, type DisponibilidadPedido } from '@/libs/api-client/stock'

/** Productos cuya cantidad pedida NO alcanza según el servidor (un sí/no por producto: nunca viene la cantidad). */
export const productosQueNoAlcanzan = (respuesta: unknown): Set<string> =>
  new Set(Array.isArray(respuesta) ? respuesta.filter((d) => d && d.disponible === false).map((d) => String(d.productoId)) : [])

const RETARDO_MS = 350

/** Cantidades válidas y ordenadas: la misma clave de caché para el mismo pedido. */
const pedidoDe = (items: DisponibilidadPedido[]) =>
  items.filter((i) => i.cantidad > 0).sort((a, b) => a.productoId.localeCompare(b.productoId))

/**
 * Quien no tiene `CAP_VER_CANTIDADES_STOCK` recibe `disponible = 0`: el cliente no puede comparar la cantidad. Le
 * pregunta al servidor `POST /Stocks/disponibilidad` (sí/no por producto) y avisa "no alcanza" sin mostrar números.
 * Quien ve cantidades no consulta: sigue comparando contra `disponible`.
 */
export function useAlcanzaStock(items: DisponibilidadPedido[], activo = true) {
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const actual = pedidoDe(items)
  // Se consulta el valor que dejó de cambiar: tipear rápido manda un solo pedido. La clave lleva el pedido, así que una
  // respuesta lenta de un valor anterior cae en su propia clave y nunca pisa la del valor vigente.
  const pedido = useDebouncedValue(actual, RETARDO_MS)
  const habilitado = activo && !verCantidades && pedido.length > 0
  const q = useQuery({
    queryKey: ['venta-nueva', 'alcanza-stock', DEPOSITO_CENTRAL_ID, pedido],
    queryFn: () => fetchDisponibilidad(DEPOSITO_CENTRAL_ID, pedido),
    enabled: habilitado,
  })
  // Mientras el valor tipeado espera su turno, la respuesta que hay es de otro valor: sigue "revisando".
  const esperando = JSON.stringify(actual) !== JSON.stringify(pedido)
  return {
    noAlcanzan: habilitado ? productosQueNoAlcanzan(q.data) : new Set<string>(),
    revisando: activo && !verCantidades && actual.length > 0 && (esperando || q.isPending),
    fallo: habilitado && q.isError,
  }
}

/** Pregunta al servidor, en el momento, qué productos de `items` no alcanzan. Falla en silencio (devuelve vacío). */
export async function consultarQueNoAlcanza(items: DisponibilidadPedido[]): Promise<Set<string>> {
  const pedido = pedidoDe(items)
  if (!pedido.length) return new Set()
  try {
    return productosQueNoAlcanzan(await fetchDisponibilidad(DEPOSITO_CENTRAL_ID, pedido))
  } catch {
    return new Set()
  }
}
