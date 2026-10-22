import { diaCalendarioAMs, sumarDiasADia } from '@/src/utils/date'
/**
 * Reglas del detalle de compra y de la recepción. Son el espejo de la web
 * (forward-frontend/apps/web/src/features/compras): `lib/acciones-compra.ts`, `ui/AccionesBajaCompra.tsx`,
 * `ui/CompraDetalle.tsx`, `core/domain/fecha-factura.ts` y `core/domain/vencimiento-estimado.ts`.
 * Deciden qué se ofrece; el servidor vuelve a chequear cada transición y es el que manda.
 */

export interface PasoCompra { label: string; estado: 'hecho' | 'actual' | 'pendiente' }

/** El camino de una compra (lienzo R8): Nota de pedido → Confirmada → Recibida. Cancelada y Anulada no lo tienen. */
export function pasosDeCompra(estado: string): PasoCompra[] | null {
  const actual = ['NotaPedido', 'Confirmado', 'Entregado'].indexOf(estado)
  if (actual < 0) return null
  return ['Nota de pedido', 'Confirmada', 'Recibida'].map((label, i) => ({
    label,
    estado: i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente',
  }))
}

export interface EntradaAcciones {
  estado: string
  eliminada: boolean
  cantidadLineas: number
  /** MOD_COMPRAS modificar: editar, confirmar y recibir (ComprasController.cs). */
  puedeModificar: boolean
  /** MOD_COMPRAS borrar: cancelar y anular la recepción. */
  puedeBorrar: boolean
  /** CAP_ANULAR_RECEPCION_COMPRAS. */
  tieneCapAnular: boolean
}
export interface AccionesDeDetalle { editar: boolean; confirmar: boolean; recibir: boolean; cancelar: boolean; anularRecepcion: boolean }

/** Qué botones tiene una compra según su estado y los permisos (PermMatriz "3 · Compras"). */
export function accionesDeDetalle(e: EntradaAcciones): AccionesDeDetalle {
  const viva = !e.eliminada
  const notaPedido = e.estado === 'NotaPedido'
  const confirmada = e.estado === 'Confirmado'
  return {
    editar: viva && e.puedeModificar && (notaPedido || confirmada),
    // Compra.Confirmar() rechaza una compra sin líneas: no se ofrece lo que el servidor rebota.
    confirmar: viva && e.puedeModificar && notaPedido && e.cantidadLineas > 0,
    recibir: viva && e.puedeModificar && confirmada,
    cancelar: viva && e.puedeBorrar && (notaPedido || confirmada),
    anularRecepcion: viva && e.puedeBorrar && e.tieneCapAnular && e.estado === 'Entregado',
  }
}

/** Lo que pasa si se aprieta, dicho antes de ejecutarlo (web: acciones-compra.ts). */
export const CONSECUENCIA = {
  recibir: 'La mercadería entró al depósito. El stock virtual pasa a real y se genera la deuda con el proveedor.',
  cancelarNotaPedido: 'La orden queda cancelada. No tocó stock ni cuenta corriente.',
  cancelarConfirmada: 'Se libera el stock virtual que esta compra tenía reservado — esas unidades dejan de contarse como "por entrar".',
  anularRecepcion:
    'Se descuenta del stock lo que ingresó esta compra, se revierte la deuda con el proveedor en su cuenta corriente y, si nadie lo cambió después, cada producto vuelve al costo que tenía antes. Si parte de la mercadería ya se vendió o está reservada, o si la compra tiene pagos imputados, no se puede anular.',
} as const

/** Unidades que entran al stock al recibir: `cantidad` ya viene en unidades (un bulto de 12 pedido x2 es 24). */
export const unidadesAIngresar = (detalles: readonly { cantidad: number }[]) =>
  detalles.reduce((suma, d) => suma + d.cantidad, 0)

export const textoSuma = (unidades: number) =>
  `Suma ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} al stock y genera la deuda con el proveedor`

// ── Fecha de factura del proveedor (web: fecha-factura.ts y vencimiento-estimado.ts) ────────────────

export interface CondicionParaVencimiento { tipo?: string | null; dias?: number | null; diaDelMes?: number | null }
export type ProblemaFechaFactura = 'falta' | 'fuera-de-rango' | null

const requiereFechaFactura = (c: CondicionParaVencimiento | null | undefined) => c?.tipo === 'DiasDesdeFactura'
const diasEnMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()
const pad = (n: number, largo = 2) => String(n).padStart(largo, '0')

/** Fecha de factura admitida: desde hace un año (un 29 de febrero cae el 28) hasta mañana. */
export function rangoFechaFactura(hoy: string): { min: string; max: string } {
  const [anio, mes, dia] = hoy.split('-').map(Number)
  return { min: `${pad(anio - 1, 4)}-${pad(mes)}-${pad(Math.min(dia, diasEnMes(anio - 1, mes)))}`, max: sumarDiasADia(hoy, 1) }
}

export function problemaFechaFactura(condicion: CondicionParaVencimiento | null | undefined, fecha: string, hoy: string): ProblemaFechaFactura {
  if (!fecha) return requiereFechaFactura(condicion) ? 'falta' : null
  if (diaCalendarioAMs(fecha) === null) return 'fuera-de-rango'
  const { min, max } = rangoFechaFactura(hoy)
  return fecha < min || fecha > max ? 'fuera-de-rango' : null
}

export const mensajeProblemaFecha = (p: NonNullable<ProblemaFechaFactura>) =>
  p === 'falta'
    ? 'La condición de pago cuenta los días desde la factura: cargá la fecha de factura del proveedor.'
    : 'La fecha de factura no puede ser posterior a mañana ni tener más de un año.'

const esEnteroEntre = (v: number | null | undefined, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** Vencimiento estimado del pago (yyyy-MM-dd) según la condición; null si no se puede calcular. */
export function calcularVencimiento(
  condicion: CondicionParaVencimiento | null | undefined,
  fechaEntrega: string,
  fechaFactura: string | null | undefined,
): string | null {
  if (!condicion || diaCalendarioAMs(fechaEntrega) === null) return null
  switch (condicion.tipo) {
    case 'Contado':
      return fechaEntrega
    case 'DiasDesdeEntrega':
      return esEnteroEntre(condicion.dias, 1, 365) ? sumarDiasADia(fechaEntrega, condicion.dias) : null
    case 'DiasDesdeFactura':
      if (!fechaFactura || diaCalendarioAMs(fechaFactura) === null) return null
      return esEnteroEntre(condicion.dias, 1, 365) ? sumarDiasADia(fechaFactura, condicion.dias) : null
    case 'DiaFijoDelMes': {
      if (!esEnteroEntre(condicion.diaDelMes, 1, 31)) return null
      const [anio, mes] = fechaEntrega.split('-').map(Number)
      const enElMes = `${pad(anio, 4)}-${pad(mes)}-${pad(Math.min(condicion.diaDelMes, diasEnMes(anio, mes)))}`
      if (enElMes > fechaEntrega) return enElMes
      const [a, m] = mes === 12 ? [anio + 1, 1] : [anio, mes + 1]
      return `${pad(a, 4)}-${pad(m)}-${pad(Math.min(condicion.diaDelMes, diasEnMes(a, m)))}`
    }
    default:
      return null
  }
}
