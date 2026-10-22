import type { Venta } from '@/libs/api-client/types'
import { esEstadoVenta } from '@/core/constants/estados'

/** `tipoOperacion` de un Pedido (1 es Presupuesto), como en `ventas/lib/resumenVentas`. */
export const TIPO_PEDIDO = 2

/**
 * "Repetir el último pedido" (D5): el pedido más reciente del cliente que sigue en pie. No se repite
 * un presupuesto, un pedido anulado, vencido ni rechazado, ni algo que la tabla de estados no conoce
 * (un borrador). La lista viene del historial de ventas que ya existe; el orden no se da por hecho.
 */
export function elegirUltimoPedido(ventas: readonly Venta[] | undefined): Venta | null {
  const validos = (ventas ?? []).filter((v) => v.tipoOperacion === TIPO_PEDIDO
    && esEstadoVenta(v.estado, 'Pendiente', 'Confirmada', 'EnPreparacion', 'Empacada', 'EnRuta', 'Entregada', 'NoEntregada', 'PendienteAutorizacion'))
  return validos.reduce<Venta | null>((ultimo, v) => (!ultimo || Date.parse(v.fecha) > Date.parse(ultimo.fecha) ? v : ultimo), null)
}
