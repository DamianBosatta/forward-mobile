import { useAuthStore } from '@/libs/store/auth.store'
import { useVentas } from '@/libs/api-client/ventas'
import { useComprasResumenInicio, usePendientesAutorizacion } from '../api/queries'

/** Un contador de Inicio. `null` = el servidor todavía no lo dio (se muestra "—", nunca 0). */
export type Contador = number | null

export interface PendientesInicio {
  /** `null` si el usuario no ve Ventas. */
  ventas: { presupuestos: Contador; pedidos: Contador; porAutorizar?: Contador } | null
  /** `null` si el usuario no ve Compras. */
  compras: { notasPedido: Contador; porRecibir: Contador } | null
  refetch: () => Promise<unknown>
}

// TipoOperacionVenta: Presupuesto = 1, Pedido = 2. Solo se pide una fila: el número es el
// totalCount que calcula el servidor sobre TODO lo filtrado (con el scoping del vendedor).
const UNA_FILA = { pageNumber: 1, pageSize: 1 } as const

/**
 * Contadores de las tarjetas de Inicio. Todos salen del servidor:
 * - Presupuestos: totalCount de GET /Ventas (Presupuesto + Pendiente).
 * - Pedidos confirmados: totalCount de GET /Ventas (Pedido + Confirmada).
 * - Por autorizar: largo de GET /Ventas/pendientes-autorizacion (lista completa, sin paginar),
 *   solo para quien tiene CAP_AUTORIZAR_VENTA.
 * - Notas de pedido y por recibir: GET /Compras/resumen (NotaPedido y Confirmado).
 * Los importes de cada fila no se muestran: ningún endpoint los suma por estado (BACKLOG-9B).
 */
export function usePendientesInicio(): PendientesInicio {
  const { canDo, hasCapability } = useAuthStore()
  const veVentas = canDo('MOD_VENTAS', 'read')
  const veCompras = canDo('MOD_COMPRAS', 'read')
  const autoriza = veVentas && hasCapability('CAP_AUTORIZAR_VENTA')

  const presupuestos = useVentas({ ...UNA_FILA, tipoOperacion: 1, estado: 'Pendiente' }, { enabled: veVentas })
  const pedidos = useVentas({ ...UNA_FILA, tipoOperacion: 2, estado: 'Confirmada' }, { enabled: veVentas })
  const porAutorizar = usePendientesAutorizacion(autoriza)
  const compras = useComprasResumenInicio(veCompras)

  const total = (q: typeof presupuestos): Contador => q.data?.totalCount ?? null

  return {
    ventas: veVentas
      ? {
          presupuestos: total(presupuestos),
          pedidos: total(pedidos),
          ...(autoriza ? { porAutorizar: porAutorizar.data?.length ?? null } : {}),
        }
      : null,
    compras: veCompras
      ? { notasPedido: compras.data?.notasPedido ?? null, porRecibir: compras.data?.confirmadas ?? null }
      : null,
    refetch: () =>
      Promise.all([
        veVentas && presupuestos.refetch(),
        veVentas && pedidos.refetch(),
        autoriza && porAutorizar.refetch(),
        veCompras && compras.refetch(),
      ]),
  }
}
