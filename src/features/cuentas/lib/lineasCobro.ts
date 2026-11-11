import { diaArgentina } from '@/core/utils/fecha'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { armarCobro, mostrarFecha, type FormCobro, type OtroMedio } from './cobro'

/** El formulario de un cobro nuevo: sin medio, sin monto y las fechas del cheque en el día de hoy. */
export function formCobroVacio(): FormCobro {
  const hoy = mostrarFecha(diaArgentina(Date.now()))
  return {
    monto: '',
    medioPagoId: null,
    esCheque: false,
    requiereCaja: false,
    depositoId: null,
    referencia: '',
    cheque: { numero: '', banco: '', titular: '', emision: hoy, pago: hoy },
    cuentaPropiaId: null,
    comprobanteUrl: null,
    chequeFotoUrl: null,
    imputaciones: null,
    otrosMedios: [],
  }
}

/**
 * Una línea de la lista de medios del cobro en pasos (paso 3, "Medios"). La línea 0 es el primer medio del
 * formulario (el único que lleva cuenta donde entró, foto del comprobante y datos del cheque); las demás son
 * los `otrosMedios` del cobro combinado. El formulario sigue siendo el mismo `FormCobro` que arma `armarCobro`.
 */
export interface LineaDelCobro {
  indice: number
  medioPagoId: string
  monto: string
  esCheque: boolean
  requiereCaja: boolean
}

/** Lo que se edita en la pantalla "Medio y monto": el medio, su monto y, solo en la línea 0, sus datos propios. */
export type BorradorMedio = Pick<FormCobro, 'medioPagoId' | 'monto' | 'esCheque' | 'requiereCaja' | 'cheque' | 'cuentaPropiaId' | 'comprobanteUrl' | 'chequeFotoUrl'>

export function lineasDelCobro(f: FormCobro): LineaDelCobro[] {
  if (!f.medioPagoId) return []
  const primera: LineaDelCobro = { indice: 0, medioPagoId: f.medioPagoId, monto: f.monto, esCheque: f.esCheque, requiereCaja: f.requiereCaja }
  const otras = f.otrosMedios.flatMap((o, i) =>
    o.medioPagoId ? [{ indice: i + 1, medioPagoId: o.medioPagoId, monto: o.monto, esCheque: o.esCheque, requiereCaja: o.requiereCaja }] : [],
  )
  return [primera, ...otras]
}

/** Alguna línea es un cheque: el cheque va en un cobro de un solo medio, así que no se agrega otro. */
export const hayCheque = (f: FormCobro) => f.esCheque || f.otrosMedios.some(o => o.esCheque)

/** Lo que se suma: el monto de cada línea, como lo suma el formulario de siempre. */
export const totalDelCobro = (f: FormCobro) =>
  (leerNumero(f.monto) ?? 0) + f.otrosMedios.reduce((s, o) => s + Math.max(leerNumero(o.monto) ?? 0, 0), 0)

const borradorVacio = (): BorradorMedio => ({
  medioPagoId: null,
  monto: '',
  esCheque: false,
  requiereCaja: false,
  cheque: formCobroVacio().cheque,
  cuentaPropiaId: null,
  comprobanteUrl: null,
  chequeFotoUrl: null,
})

/** El borrador para editar la línea `indice`, o uno vacío para una línea nueva (`null`). */
export function borradorDe(f: FormCobro, indice: number | null): BorradorMedio {
  if (indice === null) return borradorVacio()
  if (indice === 0) {
    const { medioPagoId, monto, esCheque, requiereCaja, cheque, cuentaPropiaId, comprobanteUrl, chequeFotoUrl } = f
    return { medioPagoId, monto, esCheque, requiereCaja, cheque, cuentaPropiaId, comprobanteUrl, chequeFotoUrl }
  }
  const o = f.otrosMedios[indice - 1]
  return { ...borradorVacio(), medioPagoId: o.medioPagoId, monto: o.monto, esCheque: o.esCheque, requiereCaja: o.requiereCaja }
}

/** La línea nueva o editada es la primera del formulario (la que lleva sus datos propios). */
export const esPrimeraLinea = (f: FormCobro, indice: number | null) => indice === 0 || (indice === null && !f.medioPagoId)

/** Guarda el borrador en el formulario: en la línea 0, en una de las otras o como una línea nueva al final. */
export function aplicarBorrador(f: FormCobro, indice: number | null, b: BorradorMedio): FormCobro {
  if (esPrimeraLinea(f, indice)) return { ...f, ...b }
  const otro: OtroMedio = { medioPagoId: b.medioPagoId, monto: b.monto, esCheque: b.esCheque, requiereCaja: b.requiereCaja }
  if (indice === null) return { ...f, otrosMedios: [...f.otrosMedios, otro] }
  return { ...f, otrosMedios: f.otrosMedios.map((o, j) => (j === indice - 1 ? otro : o)) }
}

/** Quita una línea. Sin la primera, la siguiente pasa a ser la primera (sin datos propios: se cargan de nuevo). */
export function quitarLinea(f: FormCobro, indice: number): FormCobro {
  if (indice > 0) return { ...f, otrosMedios: f.otrosMedios.filter((_, j) => j !== indice - 1) }
  const [siguiente, ...resto] = f.otrosMedios
  const vacio = borradorVacio()
  if (!siguiente) return { ...f, ...vacio }
  return { ...f, ...vacio, medioPagoId: siguiente.medioPagoId, monto: siguiente.monto, esCheque: siguiente.esCheque, requiereCaja: siguiente.requiereCaja, otrosMedios: resto }
}

/**
 * Por qué el borrador todavía no se puede agregar (o `null` si se puede). Usa `armarCobro` sobre un cobro de
 * esa sola línea: los mismos textos y la misma regla del monto, el medio y el cheque. Las otras líneas no llevan
 * datos de cheque (el cheque no se combina): ahí solo se piden el medio y el monto, y el aviso sale en el paso 3.
 */
export function errorDelBorrador(f: FormCobro, indice: number | null, b: BorradorMedio): string | null {
  const primera = esPrimeraLinea(f, indice)
  const prueba: FormCobro = { ...f, ...b, esCheque: primera && b.esCheque, imputaciones: null, otrosMedios: [] }
  const r = armarCobro('prueba', prueba)
  return 'error' in r ? r.error : null
}
