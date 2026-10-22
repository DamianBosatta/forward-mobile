import { esEstadoVenta } from '@/core/constants/estados'

/**
 * Qué se puede hacer con una venta, con las reglas de la web (VentaGestionDetail / VentaOperacionDetail,
 * `isVentaEditable`, `ConvertirEnPedidoAction`, `puedeRegistrarCobro`) y el mapa de PermMatriz "2 · Ventas".
 * Es la única copia de estas decisiones en la app: las pantallas solo muestran lo que sale de acá.
 */

/** Presupuestos: TipoOperacionVenta del servidor (1 = Presupuesto, 2 = Pedido). */
const PRESUPUESTO = 1

/** A los 45 días de guardado sin pasarlo a pedido ni volver a guardarlo, el servidor lo vence (`Venta.Vencer`). */
export const DIAS_VIGENCIA_PRESUPUESTO = 45

/** PermPatrones panel 3: el motivo que acompaña a "Anular" deshabilitado. Idem el título del botón de la web. */
export const MOTIVO_ANULAR_EN_RUTA = 'No se puede anular: el pedido está en ruta.'

const MOTIVO_NO_EDITABLE = 'Ya lo están preparando: no se puede editar. Para cambiarlo, hablá con el depósito.'

type CanDo = (modulo: 'MOD_VENTAS' | 'MOD_PAGOS', accion: 'read' | 'create' | 'update' | 'delete') => boolean

export interface AnularVisible {
  visible: boolean
  habilitado?: boolean
  /** Por qué está deshabilitado; solo con `visible` y sin `habilitado`. */
  motivo?: string
}

export interface AccionesDeVenta {
  /** Pendiente o Confirmada con MOD_VENTAS modificar (isVentaEditable). */
  editar: boolean
  /** Con el permiso, se ve siempre menos en Anulada y Rechazada; en ruta, deshabilitado con el motivo. */
  anular: AnularVisible
  /** Un presupuesto Pendiente con MOD_VENTAS modificar. */
  pasarAPedido: boolean
  /** Un presupuesto Vencido con MOD_VENTAS modificar (POST Ventas/{id}/reabrir). */
  reabrir: boolean
  /** Un pedido no anulado, con MOD_PAGOS leer y crear. */
  cobrar: boolean
  /** Por qué no se edita, cuando ya está en manos del depósito. */
  motivoNoEditable?: string
}

export function accionesDeVenta(
  venta: { estado: string | number | null | undefined; tipoOperacion: number | null | undefined },
  canDo: CanDo,
): AccionesDeVenta {
  const { estado } = venta
  const esPresupuesto = venta.tipoOperacion === PRESUPUESTO
  const puedeModificar = canDo('MOD_VENTAS', 'update')
  const puedeAnular = canDo('MOD_VENTAS', 'delete')
  const anulada = esEstadoVenta(estado, 'Anulada')
  const enRuta = esEstadoVenta(estado, 'EnRuta')

  const anular: AnularVisible =
    !puedeAnular || anulada || esEstadoVenta(estado, 'RechazadaAutorizacion')
      ? { visible: false }
      : enRuta
        ? { visible: true, habilitado: false, motivo: MOTIVO_ANULAR_EN_RUTA }
        : { visible: true, habilitado: true }

  const editable = esEstadoVenta(estado, 'Pendiente', 'Confirmada')
  return {
    editar: editable && puedeModificar,
    anular,
    pasarAPedido: esPresupuesto && esEstadoVenta(estado, 'Pendiente') && puedeModificar,
    reabrir: esPresupuesto && esEstadoVenta(estado, 'Vencido') && puedeModificar,
    cobrar: !esPresupuesto && !anulada && canDo('MOD_PAGOS', 'read') && canDo('MOD_PAGOS', 'create'),
    motivoNoEditable: esEstadoVenta(estado, 'EnPreparacion', 'Empacada', 'EnRuta') ? MOTIVO_NO_EDITABLE : undefined,
  }
}

/** Motivos de anulación de la lámina ResAnular; el servidor guarda el texto. */
export const MOTIVOS_DE_ANULACION = ['El cliente se arrepintió', 'Error de carga', 'Duplicado'] as const
export const MOTIVO_ANULACION_OTRO = 'Otro'

/** El motivo que se manda, o null si falta: "Otro" exige texto. */
export function motivoDeAnulacion(elegido: string | null, otro: string): string | null {
  if (!elegido) return null
  if (elegido === MOTIVO_ANULACION_OTRO) return otro.trim() || null
  return elegido
}
