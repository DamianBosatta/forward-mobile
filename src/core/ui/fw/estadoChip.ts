import type { ChipEstado } from '@/libs/theme'

export interface ChipInfo {
  estado: ChipEstado
  label: string
}

export const CHIP_LABEL: Record<ChipEstado, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  porAutorizar: 'Por autorizar',
  enCurso: 'En curso',
  entregado: 'Entregado',
  anulado: 'Anulado',
}

const chip = (estado: ChipEstado, label = CHIP_LABEL[estado]): ChipInfo => ({ estado, label })

// Mapeo ÚNICO estado del backend → chip. Clave: nombre del enum; el número es
// el valor del enum en Domain/Enum (el servidor manda uno u otro según el endpoint).
// Casos sin chip obvio en la lámina F4 (decisión documentada):
//   NoEntregada           → porAutorizar: no es terminal y pide que alguien actúe.
//   Vencido               → pendiente: presupuesto viejo que se puede reabrir.
//   RechazadaAutorizacion → anulado: terminal, pero con su propia etiqueta.
const VENTA: Record<string, [number, ChipInfo]> = {
  Pendiente: [1, chip('pendiente')],
  Confirmada: [2, chip('confirmado')],
  EnPreparacion: [3, chip('enCurso', 'En preparación')],
  Empacada: [4, chip('enCurso', 'Empacado')],
  EnRuta: [5, chip('enCurso', 'En ruta')],
  Entregada: [6, chip('entregado')],
  NoEntregada: [7, chip('porAutorizar', 'No entregado')],
  Anulada: [8, chip('anulado')],
  PendienteAutorizacion: [9, chip('porAutorizar')],
  Vencido: [10, chip('pendiente', 'Vencido')],
  RechazadaAutorizacion: [11, chip('anulado', 'Rechazado')],
}

// Lámina F4: la nota de pedido usa "Pendiente" y lo que espera llegar, "Por recibir".
const COMPRA: Record<string, [number, ChipInfo]> = {
  NotaPedido: [1, chip('pendiente')],
  Confirmado: [2, chip('enCurso', 'Por recibir')],
  Entregado: [3, chip('entregado', 'Recibido')],
  Cancelada: [4, chip('anulado', 'Cancelado')],
  Anulada: [5, chip('anulado')],
}

/** Chip de un estado de venta o compra. `null` si el estado no se conoce: no se inventa. */
export function chipForEstado(
  tipo: 'venta' | 'compra',
  estado: string | number | null | undefined,
): ChipInfo | null {
  if (estado == null) return null
  const tabla = tipo === 'venta' ? VENTA : COMPRA
  const s = String(estado)
  const porNombre = Object.prototype.hasOwnProperty.call(tabla, s) ? tabla[s] : undefined
  const fila = porNombre ?? Object.values(tabla).find(([codigo]) => String(codigo) === s)
  return fila ? fila[1] : null
}
