import { useAuthStore } from '@/libs/store/auth.store'
import { ApiError } from '@/libs/api-client/client'
import { usePendientesAutorizacion, useVentas } from '@/libs/api-client/ventas'
import { useComprasResumenInicio, useResumenInicio, type ImporteInicio } from '../api/queries'

/** Una fila de Inicio, tal como la dio el servidor. */
export interface DatoPendiente {
  /** `null` = el servidor todavía no la dio (se muestra "—", nunca 0). */
  cantidad: number | null
  /** Uno por moneda (vacío con cantidad 0). `null` = servidor sin /Inicio/resumen: solo la cantidad. */
  importes: ImporteInicio[] | null
}

export interface PendientesInicio {
  /** `null` si el usuario no ve Ventas. */
  ventas: {
    presupuestos: DatoPendiente
    pedidos: DatoPendiente
    /** `propias`: sin CAP_AUTORIZAR_VENTA son las suyas que esperan autorización, no la bandeja. */
    porAutorizar?: DatoPendiente & { propias: boolean }
  } | null
  /** `null` si el usuario no ve Compras. */
  compras: { notasPedido: DatoPendiente; porRecibir: DatoPendiente } | null
  /** Motivo del 403 (usuario desactivado): Inicio lo muestra en lugar de las tarjetas. */
  bloqueo: string | null
  refetch: () => Promise<unknown>
}

// TipoOperacionVenta: Presupuesto = 1, Pedido = 2. Solo se pide una fila: el número es el
// totalCount que calcula el servidor sobre TODO lo filtrado (con el scoping del vendedor).
const UNA_FILA = { pageNumber: 1, pageSize: 1 } as const
const contar = (n: number | null | undefined): DatoPendiente => ({ cantidad: n ?? null, importes: null })

/**
 * Pendientes de las tarjetas de Inicio. Todo sale del servidor, de GET /Inicio/resumen: cantidad e
 * importes por moneda de cada fila, y las secciones que el usuario no ve en `null`. "Por autorizar"
 * es la bandeja de todos con CAP_AUTORIZAR_VENTA; sin ella, las propias que esperan autorización.
 *
 * Servidor sin ese endpoint (404): las cuatro llamadas de antes, solo con cantidades:
 * - Presupuestos y pedidos confirmados: totalCount de GET /Ventas (Presupuesto + Pendiente, Pedido + Confirmada).
 * - Por autorizar: largo de GET /Ventas/pendientes-autorizacion, solo con CAP_AUTORIZAR_VENTA.
 * - Notas de pedido y por recibir: GET /Compras/resumen (NotaPedido y Confirmado).
 */
export function usePendientesInicio(): PendientesInicio {
  const { canDo, hasCapability } = useAuthStore()
  const veVentas = canDo('MOD_VENTAS', 'read')
  const veCompras = canDo('MOD_COMPRAS', 'read')
  const autoriza = veVentas && hasCapability('CAP_AUTORIZAR_VENTA')

  const resumen = useResumenInicio(veVentas || veCompras)
  const viejo = resumen.data === null
  const presupuestos = useVentas({ ...UNA_FILA, tipoOperacion: 1, estado: 'Pendiente' }, { enabled: viejo && veVentas })
  const pedidos = useVentas({ ...UNA_FILA, tipoOperacion: 2, estado: 'Confirmada' }, { enabled: viejo && veVentas })
  const bandeja = usePendientesAutorizacion(viejo && autoriza)
  const compras = useComprasResumenInicio(viejo && veCompras)

  const refetch = () =>
    Promise.all([
      (veVentas || veCompras) && resumen.refetch(),
      viejo && veVentas && presupuestos.refetch(),
      viejo && veVentas && pedidos.refetch(),
      viejo && autoriza && bandeja.refetch(),
      viejo && veCompras && compras.refetch(),
    ])

  const e = resumen.error
  if (e instanceof ApiError && e.status === 403) return { ventas: null, compras: null, bloqueo: e.message, refetch }

  const r = resumen.data
  if (r) {
    return {
      ventas: r.ventas && {
        presupuestos: r.ventas.presupuestosPendientes,
        pedidos: r.ventas.pedidosConfirmados,
        porAutorizar: r.autorizacionesPendientes
          ? { ...r.autorizacionesPendientes, propias: false }
          : { ...r.ventas.porAutorizar, propias: true },
      },
      compras: r.compras && { notasPedido: r.compras.notasPedido, porRecibir: r.compras.porRecibir },
      bloqueo: null,
      refetch,
    }
  }

  // Mientras llega el resumen, si falló o con el servidor viejo: las tarjetas según los permisos,
  // con lo que haya ("—" donde no hay dato).
  const porAutorizar = autoriza
    ? { ...contar(bandeja.data?.length), propias: false }
    : viejo ? undefined : { ...contar(null), propias: true }
  return {
    ventas: veVentas
      ? { presupuestos: contar(presupuestos.data?.totalCount), pedidos: contar(pedidos.data?.totalCount), ...(porAutorizar ? { porAutorizar } : {}) }
      : null,
    compras: veCompras ? { notasPedido: contar(compras.data?.notasPedido), porRecibir: contar(compras.data?.confirmadas) } : null,
    bloqueo: null,
    refetch,
  }
}
